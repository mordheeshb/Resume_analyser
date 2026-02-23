import json
import boto3
import io
import uuid
from PyPDF2 import PdfReader

# AWS Clients
s3 = boto3.client("s3")
dynamodb = boto3.resource("dynamodb")

# CONFIG
BUCKET_NAME = "resume-analyzer-mordheesh-2026"
TABLE_NAME = "JobRoles"

table = dynamodb.Table(TABLE_NAME)


# --------------------------------
# Extract text from PDF
# --------------------------------
def extract_text_from_pdf(file_bytes):
    pdf_stream = io.BytesIO(file_bytes)
    reader = PdfReader(pdf_stream)
    text = ""
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text += page_text
    return text.lower()


# --------------------------------
# Match skills in text
# --------------------------------
def extract_skills_from_text(text, skills_list):
    matched = []
    for skill in skills_list:
        if skill.lower() in text:
            matched.append(skill)
    return matched


# --------------------------------
# Scan DynamoDB with pagination
# --------------------------------
def scan_all_roles():
    items = []
    response = table.scan()
    items.extend(response.get("Items", []))
    while "LastEvaluatedKey" in response:
        response = table.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
        items.extend(response.get("Items", []))
    return items


# --------------------------------
# CORS Headers
# --------------------------------
def cors_headers():
    return {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
        "Access-Control-Allow-Headers": "Content-Type"
    }


# --------------------------------
# Lambda Handler
# --------------------------------
def lambda_handler(event, context):
    try:
        # Handle CORS preflight (OPTIONS request from browser)
        if event.get("httpMethod") == "OPTIONS":
            return {"statusCode": 200, "headers": cors_headers(), "body": ""}

        # Parse body — API Gateway sends it as a JSON string
        body = json.loads(event["body"]) if "body" in event else event
        action = body.get("action", "")

        # ── ACTION: generateUploadUrl ─────────────────────────────────────
        # Generates a pre-signed S3 PUT URL so the browser can upload directly.
        if action == "generateUploadUrl":
            file_name = body.get("fileName", "resume.pdf")
            file_key = f"resumes/{uuid.uuid4()}-{file_name}"

            upload_url = s3.generate_presigned_url(
                "put_object",
                Params={
                    "Bucket": BUCKET_NAME,
                    "Key": file_key,
                    "ContentType": "application/pdf"
                },
                ExpiresIn=300  # URL valid for 5 minutes
            )

            return {
                "statusCode": 200,
                "headers": cors_headers(),
                "body": json.dumps({"uploadUrl": upload_url, "fileKey": file_key})
            }

        # ── ACTION: analyzeResume ─────────────────────────────────────────
        # Downloads the uploaded PDF from S3 and matches skills vs DynamoDB.
        elif action == "analyzeResume":
            file_key = body.get("fileKey")
            if not file_key:
                return {
                    "statusCode": 400,
                    "headers": cors_headers(),
                    "body": json.dumps({"error": "fileKey is required"})
                }

            # Download resume from S3
            file_obj = s3.get_object(Bucket=BUCKET_NAME, Key=file_key)
            file_bytes = file_obj["Body"].read()
            resume_text = extract_text_from_pdf(file_bytes)

            # Fetch all job roles from DynamoDB
            items = scan_all_roles()
            suggestions = []

            for item in items:
                role_name = item.get("roleName")
                role_skills = item.get("skills", [])
                if not role_skills:
                    continue

                matched_skills = extract_skills_from_text(resume_text, role_skills)
                match_percentage = (len(matched_skills) / len(role_skills)) * 100
                missing_skills = list(set(role_skills) - set(matched_skills))

                suggestions.append({
                    "role": role_name,
                    "matchPercentage": round(match_percentage, 2),
                    "matchedSkills": matched_skills,
                    "missingSkills": missing_skills
                })

            # Sort highest match first
            suggestions.sort(key=lambda x: x["matchPercentage"], reverse=True)
            top_match = suggestions[0] if suggestions else None

            return {
                "statusCode": 200,
                "headers": cors_headers(),
                "body": json.dumps({"topMatch": top_match, "allSuggestions": suggestions})
            }

        # ── Unknown action ────────────────────────────────────────────────
        else:
            return {
                "statusCode": 400,
                "headers": cors_headers(),
                "body": json.dumps({"error": f"Unknown action: '{action}'. Use generateUploadUrl or analyzeResume."})
            }

    except Exception as e:
        return {
            "statusCode": 500,
            "headers": cors_headers(),
            "body": json.dumps({"error": str(e)})
        }
