"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    RadarChart, Radar, PolarGrid, PolarAngleAxis,
    ResponsiveContainer,
} from "recharts";
import {
    Shield, Play, FileText, CheckCircle2,
    Upload, LogOut, Activity, Cpu, TrendingUp,
    LayoutDashboard, User, Briefcase, Zap, Search,
    ArrowUpRight, Info, CloudUpload, AlertTriangle, Trophy, Medal,
    Target
} from "lucide-react";

// ─── API endpoint ─────────────────────────────────────────────────────────────
// All resume work is now handled by the Next.js API route at /api/resume.
// It calls S3 and DynamoDB directly server-side — no Lambda / API Gateway needed.
const AWS_API_ENDPOINT = "/api/resume";



// ─── Types ────────────────────────────────────────────────────────────────────

interface RoadmapStep {
    step: string;
    cert: string;
    timeEstimate: string;
    scoreGain: string;
}

interface RadarData {
    subject: string;
    A: number;
}

/** Shape returned by the Lambda analyzeResume action */
interface JobMatch {
    jobRole: string;
    percentage: number;
    matched: string[];
    missing: string[];
}

/** Normalised result stored in component state */
interface AnalysisResult {
    topMatches: JobMatch[];           // top-3 sorted by score
    primaryMatch: JobMatch;           // highest-score role (convenience alias)
    insight: string;
    roadmap: RoadmapStep[];
    radarData: RadarData[];
}

// ─── Upload status labels ─────────────────────────────────────────────────────
type UploadPhase =
    | "idle"
    | "requesting_url"
    | "uploading_s3"
    | "analyzing"
    | "done"
    | "error";

const PHASE_LABELS: Record<UploadPhase, string> = {
    idle: "Start Analysis",
    requesting_url: "Preparing upload...",
    uploading_s3: "Uploading to storage...",
    analyzing: "Analyzing skills...",
    done: "Start Analysis",
    error: "Retry Analysis",
};

// ─── Target job roles ─────────────────────────────────────────────────────────
const TARGET_ROLES = [
    "Frontend Engineer",
    "Backend Engineer",
    "Full Stack Developer",
    "Data Scientist",
    "ML Engineer",
    "DevOps / Cloud",
    "Product Manager",
    "UI/UX Designer",
    "Cybersecurity Analyst",
];

// ─── Radar helper ─────────────────────────────────────────────────────────────
function buildRadarData(matched: string[], missing: string[]): RadarData[] {
    const categories = [
        { name: "Frontend", skills: ["React", "TypeScript", "Next.js", "Tailwind CSS", "HTML", "CSS"] },
        { name: "Backend", skills: ["Node.js", "Express", "Python", "Go", "Java", "SQL", "PostgreSQL"] },
        { name: "Cloud", skills: ["AWS", "Azure", "GCP", "Docker", "Kubernetes", "S3", "Lambda"] },
        { name: "Tooling", skills: ["Git", "Jest", "System Design", "CI/CD", "Terraform"] },
        { name: "Soft Skills", skills: ["Leadership", "Agility", "Communication", "Problem Solving"] },
    ];
    const allSkills = [...matched, ...missing].map(s => s.toLowerCase());
    const matchedLower = matched.map(s => s.toLowerCase());

    return categories.map(cat => {
        const catSkills = cat.skills.map(s => s.toLowerCase());
        const totalInCat = catSkills.filter(s => allSkills.some(as => as.includes(s) || s.includes(as))).length || 1;
        const matchedInCat = catSkills.filter(s => matchedLower.some(ms => ms.includes(s) || s.includes(ms))).length;
        return { subject: cat.name, A: Math.round((matchedInCat / totalInCat) * 100) || 15 };
    });
}

function generateInsight(primary: JobMatch): string {
    const { percentage, jobRole, matched, missing } = primary;
    if (percentage >= 80)
        return `Incredible match! Your profile aligns perfectly with ${jobRole}. Expertise in ${matched.slice(0, 2).join(", ")} is highly valued.`;
    if (percentage >= 50)
        return `Strong foundation for ${jobRole}. Adding ${missing.slice(0, 2).join(", ")} will make you an elite candidate.`;
    return `Growth opportunity. Focus on ${missing.slice(0, 2).join(", ")} to transition effectively into ${jobRole}.`;
}

function generateRoadmap(missing: string[]): RoadmapStep[] {
    return missing.slice(0, 3).map((skill, i) => ({
        step: `Master ${skill}`,
        cert: `Certified ${skill} Developer`,
        timeEstimate: `${2 + i} weeks`,
        scoreGain: `+${Math.max(5, Math.floor(15 / (i + 1)))}%`,
    }));
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Dashboard() {
    const [user, setUser] = useState<any>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [fileName, setFileName] = useState("");
    const [phase, setPhase] = useState<UploadPhase>("idle");
    const [phaseDetail, setPhaseDetail] = useState("");   // progress sub-text
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const [errorMsg, setErrorMsg] = useState("");
    const [activeTab, setActiveTab] = useState("Dashboard");
    const [showDropdown, setShowDropdown] = useState(false); // FIXED: move to top
    const [targetRole, setTargetRole] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    // ── Auth guard ──────────────────────────────────────────────────────────
    useEffect(() => {
        const storedUser = localStorage.getItem("user");
        const token = localStorage.getItem("token");
        if (!storedUser || !token) {
            router.push("/login");
        } else {
            setUser(JSON.parse(storedUser));
        }
    }, [router]);

    if (!user) return (
        <div className="h-screen flex items-center justify-center bg-gray-50">
            <div className="w-10 h-10 border-4 border-gray-200 border-t-[#4285F4] rounded-full animate-spin" />
        </div>
    );

    // ── File selection ───────────────────────────────────────────────────────
    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.name.endsWith(".pdf")) {
            setErrorMsg("Only PDF files are supported. Please select a .pdf file.");
            setPhase("error");
            return;
        }
        setSelectedFile(file);
        setFileName(file.name);
        setPhase("idle");
        setErrorMsg("");
        setResult(null);
    };

    // ── 3-step AWS flow: generateUploadUrl → S3 PUT → analyzeResume ──────────
    async function handleAnalyze() {
        if (!selectedFile) {
            setErrorMsg("Please select a PDF resume file first.");
            setPhase("error");
            return;
        }

        setErrorMsg("");
        setResult(null);

        // Normalize Lambda field names to our internal JobMatch shape
        // Lambda:  { role, matchPercentage, matchedSkills, missingSkills }
        // Our UI:  { jobRole, percentage, matched, missing }
        function normalizeMatch(m: any): JobMatch {
            return {
                jobRole: m.role ?? m.jobRole ?? "Unknown",
                percentage: m.matchPercentage ?? m.percentage ?? 0,
                matched: m.matchedSkills ?? m.matched ?? [],
                missing: m.missingSkills ?? m.missing ?? [],
            };
        }

        // Helper: POST to /api/resume (Next.js API route — plain JSON, no API Gateway wrapper)
        async function callApi(label: string, payload: object): Promise<any> {
            console.log(`[API] ${label} →`, payload);
            let res: Response;
            try {
                res = await fetch(AWS_API_ENDPOINT, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
            } catch (netErr: any) {
                throw new Error(`Network error on ${label}: ${netErr.message}`);
            }
            const rawText = await res.text();
            console.log(`[API] ${label} ← HTTP ${res.status}:`, rawText);
            if (!res.ok) {
                throw new Error(`${label} failed (HTTP ${res.status}): ${rawText || "(empty response)"}`);
            }
            try { return JSON.parse(rawText); } catch { return {}; }
        }

        try {
            // ── STEP 1: Get a pre-signed S3 upload URL ─────────────────────
            setPhase("requesting_url");
            setPhaseDetail("Requesting secure upload URL...");

            const urlPayload = await callApi("generateUploadUrl", {
                action: "generateUploadUrl",
                fileName: selectedFile.name,
                contentType: "application/pdf",
            });

            const uploadUrl: string = urlPayload?.uploadUrl ?? urlPayload?.upload_url ?? "";
            const fileKey: string = urlPayload?.fileKey ?? urlPayload?.file_key ?? "";

            console.log("[API] uploadUrl:", uploadUrl, "| fileKey:", fileKey);

            if (!uploadUrl || !fileKey) {
                throw new Error(
                    `generateUploadUrl missing uploadUrl/fileKey.\nGot: ${JSON.stringify(urlPayload)}`
                );
            }

            // ── STEP 2: PUT the PDF directly to S3 via pre-signed URL ──────
            setPhase("uploading_s3");
            setPhaseDetail(`Uploading "${selectedFile.name}" to S3...`);

            console.log("[S3] PUT →", uploadUrl);
            let s3Res: Response;
            try {
                s3Res = await fetch(uploadUrl, {
                    method: "PUT",
                    headers: { "Content-Type": "application/pdf" },
                    body: selectedFile,
                });
            } catch (s3Err: any) {
                throw new Error(
                    `S3 upload failed: ${s3Err.message}\n` +
                    `Add a CORS rule to S3 bucket allowing PUT from http://localhost:3000`
                );
            }
            console.log("[S3] PUT ← HTTP", s3Res.status);
            if (!s3Res.ok) {
                const s3Body = await s3Res.text();
                throw new Error(`S3 PUT HTTP ${s3Res.status}: ${s3Body}`);
            }

            // ── STEP 3: Ask API to analyse the uploaded resume ──────────────
            setPhase("analyzing");
            setPhaseDetail("The AI Engine is matching your skills against industry roles...");

            const analysisPayload = await callApi("analyzeResume", {
                action: "analyzeResume",
                fileKey,
            });

            // Lambda returns allSuggestions array
            const rawList: any[] =
                Array.isArray(analysisPayload?.allSuggestions) ? analysisPayload.allSuggestions :
                    Array.isArray(analysisPayload?.topMatches) ? analysisPayload.topMatches :
                        Array.isArray(analysisPayload?.matches) ? analysisPayload.matches :
                            Array.isArray(analysisPayload) ? analysisPayload :
                                analysisPayload?.topMatch ? [analysisPayload.topMatch] :
                                    [];

            if (rawList.length === 0) {
                throw new Error(
                    `No job matches returned.\nFull response: ${JSON.stringify(analysisPayload)}`
                );
            }

            const rawMatches = rawList.map(normalizeMatch);
            let sorted = [...rawMatches].sort((a, b) => b.percentage - a.percentage);

            // If user selected a target role, pin it to position 0
            if (targetRole) {
                const targetKey = targetRole.toLowerCase();
                const pinnedIdx = sorted.findIndex(m =>
                    m.jobRole.toLowerCase().includes(targetKey) ||
                    targetKey.includes(m.jobRole.toLowerCase())
                );
                if (pinnedIdx > 0) {
                    const [pinned] = sorted.splice(pinnedIdx, 1);
                    sorted = [pinned, ...sorted];
                }
            }

            const topMatches = sorted.slice(0, 3);
            const primaryMatch = topMatches[0];

            setResult({
                topMatches,
                primaryMatch,
                insight: generateInsight(primaryMatch),
                roadmap: generateRoadmap(primaryMatch.missing),
                radarData: buildRadarData(primaryMatch.matched, primaryMatch.missing),
            });
            setPhase("done");

        } catch (err: any) {
            console.error("[Analysis Error]", err);
            setErrorMsg(err.message ?? "Unexpected error. Check DevTools Console.");
            setPhase("error");
        }
    }





    const logout = () => { localStorage.clear(); router.push("/login"); };

    const isProcessing = phase === "requesting_url" || phase === "uploading_s3" || phase === "analyzing";

    const navItems = [
        { name: "Dashboard", icon: LayoutDashboard },
        { name: "Career AI", icon: Cpu },
        { name: "Jobs", icon: Briefcase },
        { name: "Intelligence", icon: TrendingUp },
        { name: "Profile", icon: User },
    ];

    // ─── Medal icons for top 3 ──────────────────────────────────────────────
    const rankIcons = [Trophy, Medal, Medal];
    const rankColors = ["text-[#FF9F0A]", "text-[#BFC0C0]", "text-[#CD7F32]"];

    // ─── Dashboard Tab ──────────────────────────────────────────────────────
    const renderDashboard = () => (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 relative z-10">
            {/* Left Column */}
            <section className="space-y-10">
                {/* Primary Match Ring */}
                <div className="bg-white p-10 rounded-[40px] border border-gray-100 google-shadow relative overflow-hidden group">
                    <div className="flex justify-between items-center mb-10">
                        <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-[#4285F4]" />
                            Skill Match Vector
                        </h2>
                        {result && (
                            <span className="text-[9px] font-bold text-[#34A853] bg-[#34A853]/5 px-3 py-1.5 rounded-full border border-[#34A853]/10 tracking-widest uppercase">Aligned</span>
                        )}
                    </div>

                    <div className="flex flex-col md:flex-row items-center justify-around gap-10">
                        {/* Circular Activity Ring */}
                        <div className="relative w-56 h-56 flex items-center justify-center shrink-0">
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 200 200">
                                <circle cx="100" cy="100" r="85" fill="transparent" stroke="#f8f9fa" strokeWidth="16" strokeLinecap="round" />
                                <motion.circle
                                    cx="100" cy="100" r="85" fill="transparent"
                                    stroke="#4285F4" strokeWidth="16" strokeDasharray={534}
                                    initial={{ strokeDashoffset: 534 }}
                                    animate={{ strokeDashoffset: 534 - (534 * (result?.primaryMatch?.percentage || 0)) / 100 }}
                                    transition={{ duration: 2, ease: "easeOut" }}
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div className="absolute flex flex-col items-center">
                                <motion.span
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    key={result?.primaryMatch?.percentage}
                                    className="text-5xl font-black tracking-tighter text-gray-900 leading-none"
                                >
                                    {result?.primaryMatch?.percentage || 0}%
                                </motion.span>
                                <span className="text-[8px] font-bold uppercase tracking-widest text-gray-300 mt-2">Core Match</span>
                            </div>
                        </div>

                        {/* Radar */}
                        <div className="w-full h-64 md:w-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart data={result?.radarData || [
                                    { subject: "F", A: 30 }, { subject: "B", A: 40 },
                                    { subject: "C", A: 20 }, { subject: "T", A: 60 }, { subject: "S", A: 50 }
                                ]}>
                                    <PolarGrid stroke="#f1f3f4" />
                                    <PolarAngleAxis dataKey="subject" tick={{ fill: "#9aa0a6", fontSize: 10, fontWeight: "600" }} />
                                    <Radar name="Skills" dataKey="A" stroke="#4285F4" fill="#4285F4" fillOpacity={0.1} strokeWidth={3} />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="mt-12 p-6 bg-gray-50/50 rounded-3xl border border-gray-100 flex items-start gap-4">
                        <Info className="w-5 h-5 text-[#4285F4] shrink-0 mt-0.5" />
                        <p className="text-sm text-gray-600 leading-relaxed font-medium">
                            {result?.insight || "Upload your PDF resume to begin a professional analysis of your skills and career trajectory."}
                        </p>
                    </div>
                </div>

                {/* ── Top 3 Job Matches ── */}
                {result && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white p-10 rounded-[40px] border border-gray-100 google-shadow space-y-6"
                    >
                        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 flex items-center gap-2 mb-6">
                            <Trophy className="w-4 h-4 text-[#FBBC05]" />
                            Top Career Matches
                        </h3>
                        {result.topMatches.map((match, i) => {
                            const RankIcon = rankIcons[i] || Medal;
                            return (
                                <motion.div
                                    key={match.jobRole}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    className={`flex items-center gap-5 p-6 rounded-3xl border transition-all ${i === 0 ? "bg-[#4285F4]/5 border-[#4285F4]/10" : "bg-white border-gray-50 hover:bg-gray-50"}`}
                                >
                                    <RankIcon className={`w-6 h-6 shrink-0 ${i === 0 ? "text-[#FBBC05]" : "text-gray-300"}`} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-lg font-bold text-gray-900 tracking-tight truncate">{match.jobRole}</p>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                                            {match.matched.length} Matched · {match.missing.length} Gaps
                                        </p>
                                    </div>
                                    <div className="shrink-0 text-right">
                                        <span className={`text-2xl font-black tracking-tighter ${i === 0 ? "text-[#4285F4]" : "text-gray-400"}`}>
                                            {match.percentage}%
                                        </span>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </motion.div>
                )}

                {/* Upload Zone */}
                <div className="bg-white p-8 rounded-[40px] border border-gray-100 google-shadow group hover:bg-gray-50/30 transition-colors">
                    <div className="flex items-center justify-between mb-8 px-2">
                        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 flex items-center gap-3">
                            <FileText className="w-4 h-4 text-[#EA4335]" />
                            Resume Upload
                        </h3>
                        {fileName && (
                            <button
                                onClick={() => { setFileName(""); setSelectedFile(null); setResult(null); setPhase("idle"); setErrorMsg(""); }}
                                className="text-[#EA4335] text-[10px] font-bold uppercase tracking-widest hover:underline"
                            >
                                Clear
                            </button>
                        )}
                    </div>

                    <div
                        onClick={() => fileRef.current?.click()}
                        className={`border-2 border-dashed rounded-[32px] p-12 text-center cursor-pointer transition-all ${fileName ? "border-[#4285F4]/30 bg-[#4285F4]/5" : "border-gray-100 hover:border-[#4285F4]/20 hover:bg-gray-50"
                            }`}
                    >
                        <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleFile} />
                        {fileName ? (
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-16 h-16 bg-[#4285F4]/10 rounded-2xl flex items-center justify-center text-[#4285F4] shadow-sm">
                                    <CheckCircle2 className="w-8 h-8" />
                                </div>
                                <span className="text-xl font-bold text-gray-900 tracking-tight">{fileName}</span>
                                <span className="text-[9px] font-bold text-[#4285F4] uppercase tracking-widest">Verified PDF</span>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center text-gray-300 group-hover:text-[#4285F4] group-hover:scale-110 transition-all duration-300">
                                    <Upload className="w-10 h-10" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-lg font-bold text-gray-600 leading-none">Drop your resume</p>
                                    <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">PDF · Max 10MB</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* Right Column */}
            <section className="space-y-10 h-fit">
                <div className="bg-white p-10 rounded-[40px] border border-gray-100 google-shadow relative overflow-hidden h-full">
                    <div className="flex justify-between items-start mb-10">
                        <div>
                            <h2 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">Resume Intelligence</h2>
                            <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Powered by AI Engine</p>
                        </div>
                        <div className="p-4 bg-[#4285F4]/10 rounded-2xl text-[#4285F4]">
                            <CloudUpload className="w-6 h-6" />
                        </div>
                    </div>

                    {/* Phase progress indicator */}
                    {isProcessing && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="mb-8 p-6 bg-[#4285F4]/5 border border-[#4285F4]/10 rounded-3xl space-y-4"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-5 h-5 border-2 border-[#4285F4]/30 border-t-[#4285F4] rounded-full animate-spin shrink-0" />
                                <div>
                                    <p className="text-xs font-bold text-[#4285F4] uppercase tracking-wider">{PHASE_LABELS[phase]}</p>
                                    <p className="text-[10px] text-gray-400 font-medium mt-0.5">{phaseDetail}</p>
                                </div>
                            </div>
                            {/* Step progress pills */}
                            <div className="flex gap-2 mt-2">
                                {(["requesting_url", "uploading_s3", "analyzing"] as UploadPhase[]).map((p, i) => {
                                    const phases = ["requesting_url", "uploading_s3", "analyzing"];
                                    const currentIdx = phases.indexOf(phase);
                                    const done = i < currentIdx;
                                    const active = i === currentIdx;
                                    return (
                                        <div
                                            key={p}
                                            className={`h-1 flex-1 rounded-full transition-all duration-500 ${done ? "bg-[#34A853]" :
                                                active ? "bg-[#4285F4]" :
                                                    "bg-gray-100"
                                                }`}
                                        />
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}

                    {/* Error state */}
                    {phase === "error" && errorMsg && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-8 p-6 bg-red-50 border border-red-100 rounded-3xl flex items-start gap-4"
                        >
                            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs font-bold text-red-600 uppercase tracking-wider">Analysis error</p>
                                <p className="text-[11px] text-red-500/80 font-medium mt-1 leading-relaxed">{errorMsg}</p>
                            </div>
                        </motion.div>
                    )}

                    {/* Matched skills grid */}
                    <div className="space-y-6 mb-10">
                        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest px-2 block">Identified Strengths</span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <AnimatePresence mode="popLayout">
                                {result ? (
                                    result.primaryMatch.matched.slice(0, 4).map((skill: string, i: number) => (
                                        <motion.div
                                            key={skill}
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: i * 0.1 }}
                                            className="p-6 rounded-3xl bg-gray-50/50 border border-gray-100 flex items-center justify-between group cursor-default hover:bg-white hover:shadow-sm hover:border-[#34A853]/20 transition-all"
                                        >
                                            <div className="flex flex-col">
                                                <span className="text-[8px] font-bold text-[#34A853] uppercase mb-1 tracking-widest">Matched</span>
                                                <span className="text-sm font-bold text-gray-700 tracking-tight">{skill}</span>
                                            </div>
                                            <ArrowUpRight className="w-4 h-4 text-[#34A853] opacity-20 group-hover:opacity-100 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                                        </motion.div>
                                    ))
                                ) : (
                                    [1, 2, 3, 4].map(i => (
                                        <div key={i} className="p-10 rounded-3xl bg-gray-50/30 animate-pulse border border-gray-100" />
                                    ))
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* ── Target Role Selector ── */}
                    <div className="mb-8">
                        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest px-2 block mb-4">
                            Target Role
                            {targetRole && (
                                <button
                                    onClick={() => setTargetRole(null)}
                                    className="ml-3 text-[#EA4335] hover:underline normal-case font-semibold tracking-normal"
                                >
                                    Clear
                                </button>
                            )}
                        </span>
                        <div className="flex flex-wrap gap-2">
                            {TARGET_ROLES.map((role) => {
                                const isSelected = targetRole === role;
                                return (
                                    <motion.button
                                        key={role}
                                        onClick={() => setTargetRole(isSelected ? null : role)}
                                        whileTap={{ scale: 0.96 }}
                                        className={`px-4 py-2 rounded-xl text-[11px] font-bold transition-all border ${isSelected
                                            ? "bg-[#4285F4] text-white border-[#4285F4] shadow-sm"
                                            : "bg-gray-50 text-gray-500 border-gray-100 hover:border-[#4285F4]/30 hover:text-[#4285F4] hover:bg-[#4285F4]/5"
                                            }`}
                                    >
                                        {role}
                                    </motion.button>
                                );
                            })}
                        </div>
                    </div>

                    {/* CTA Button */}
                    <button
                        onClick={handleAnalyze}
                        disabled={isProcessing || !selectedFile}
                        className="w-full h-16 bg-[#4285F4] text-white flex items-center justify-center gap-3 rounded-2xl text-lg font-bold shadow-sm hover:bg-[#3b78e7] hover:scale-[1.01] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isProcessing
                            ? PHASE_LABELS[phase]
                            : phase === "error"
                                ? "Retry Analysis"
                                : targetRole
                                    ? `Analyse for ${targetRole}`
                                    : "Start Analysis"}
                        <Play className={`w-5 h-5 ${isProcessing ? "animate-bounce" : ""}`} />
                    </button>

                    {/* Roadmap preview if analysis complete */}
                    {result && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-8 pt-8 border-t border-gray-100"
                        >
                            <div className="flex items-center gap-3 text-gray-400">
                                <Search className="w-4 h-4" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Analysis Results Ready</span>
                            </div>
                        </motion.div>
                    )}
                </div>

                {/* Operational Roadmap */}
                {result && (
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-16 bg-white p-10 rounded-[40px] border border-gray-100 google-shadow"
                    >
                        <div className="flex items-center gap-4 mb-8">
                            <Activity className="w-5 h-5 text-[#EA4335]" />
                            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Strategic Roadmap</h3>
                        </div>
                        <div className="space-y-4">
                            {result.roadmap.map((step: RoadmapStep, i: number) => (
                                <div key={i} className="flex items-center gap-6 p-6 bg-gray-50/50 rounded-[32px] border border-gray-100 hover:bg-gray-50 transition-colors">
                                    <div className="w-12 h-12 rounded-2xl bg-white border border-gray-100 flex items-center justify-center text-[#4285F4] font-bold text-lg shadow-sm shrink-0">{i + 1}</div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-base font-bold text-gray-900 tracking-tight leading-tight mb-1 truncate">{step.step}</p>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{step.cert}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-lg font-black text-[#34A853] tracking-tighter">{step.scoreGain}</p>
                                        <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">{step.timeEstimate}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </section>
        </div>
    );

    const renderCareerAI = () => (
        <div className="space-y-10 relative z-10">
            <div className="bg-white p-12 rounded-[40px] border border-gray-100 google-shadow overflow-hidden relative">
                <div className="absolute top-0 right-0 w-80 h-80 bg-[#4285F4]/5 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2" />
                <h2 className="text-3xl font-bold mb-6 flex items-center gap-4 text-gray-900 tracking-tight">
                    <Cpu className="w-10 h-10 text-[#4285F4]" />
                    Career Guidance AI
                </h2>
                <p className="text-gray-500 max-w-2xl text-lg mb-12 leading-relaxed font-medium">
                    Unlock your next career step with personalized AI-driven suggestions, trending roles, and actionable tips tailored just for you.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
                    <div className="bg-gray-50/50 p-8 rounded-3xl border border-gray-100">
                        <h4 className="text-sm font-bold text-gray-900 mb-6 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-[#34A853]" />
                            Strengths identified
                        </h4>
                        <ul className="space-y-3">
                            {result?.primaryMatch?.matched?.length ? result.primaryMatch.matched.slice(0, 6).map((skill: string, i: number) => (
                                <li key={i} className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#34A853]" />
                                    <span className="text-gray-600 text-sm font-medium">{skill}</span>
                                </li>
                            )) : (
                                <li className="text-gray-400 text-sm font-medium italic">Upload your resume to see your strengths.</li>
                            )}
                        </ul>
                    </div>
                    <div className="bg-gray-50/50 p-8 rounded-3xl border border-gray-100">
                        <h4 className="text-sm font-bold text-gray-900 mb-6 flex items-center gap-2">
                            <Activity className="w-4 h-4 text-[#EA4335]" />
                            Areas for growth
                        </h4>
                        <ul className="space-y-3">
                            {result?.primaryMatch?.missing?.length ? result.primaryMatch.missing.slice(0, 5).map((skill: string, i: number) => (
                                <li key={i} className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#EA4335]" />
                                    <span className="text-gray-600 text-sm font-medium">{skill}</span>
                                </li>
                            )) : (
                                <li className="text-gray-400 text-sm font-medium italic">No growth gaps found.</li>
                            )}
                        </ul>
                    </div>
                    <div className="bg-gray-50/50 p-8 rounded-3xl border border-gray-100">
                        <h4 className="text-sm font-bold text-gray-900 mb-6 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-[#FBBC05]" />
                            Trending Roles
                        </h4>
                        <ul className="space-y-3">
                            {result?.topMatches?.length ? result.topMatches.map((match: any, i: number) => (
                                <li key={i} className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#FBBC05]" />
                                    <span className="text-gray-600 text-sm font-medium truncate">{match.jobRole}</span>
                                </li>
                            )) : (
                                <li className="text-gray-400 text-sm font-medium italic">Complete analysis to see matches.</li>
                            )}
                        </ul>
                    </div>
                </div>
                <div className="bg-[#4285F4]/5 p-8 rounded-[32px] border border-[#4285F4]/10">
                    <h4 className="text-sm font-bold text-[#4285F4] mb-4">Actionable AI Insights</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex items-start gap-4">
                            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-xs font-bold text-[#4285F4] shadow-sm shrink-0">1</div>
                            <p className="text-gray-600 text-sm leading-relaxed">Focus on building expertise in missing skills to increase match probability.</p>
                        </div>
                        <div className="flex items-start gap-4">
                            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-xs font-bold text-[#4285F4] shadow-sm shrink-0">2</div>
                            <p className="text-gray-600 text-sm leading-relaxed">Target roles where your match percentage is above 85% for highest success.</p>
                        </div>
                    </div>
                </div>
            </div>
            {!result && (
                <div className="flex flex-col items-center justify-center p-24 bg-white rounded-[40px] border border-gray-100 google-shadow text-center">
                    <div className="w-24 h-24 bg-gray-50 rounded-3xl flex items-center justify-center mb-8 border border-gray-100 group">
                        <Cpu className="w-12 h-12 text-gray-200 group-hover:text-[#4285F4] group-hover:scale-110 transition-all duration-500" />
                    </div>
                    <h3 className="text-2xl font-bold mb-2 text-gray-900">Awaiting Data</h3>
                    <p className="text-gray-400 max-w-sm text-sm font-medium">Upload your resume on the Dashboard to unlock customized career insights.</p>
                </div>
            )}
        </div>
    );

    const renderJobs = () => (
        <div className="space-y-10 relative z-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-10 mb-12">
                <div>
                    <h2 className="text-4xl font-bold text-gray-900 tracking-tight mb-2">Recommended Jobs</h2>
                    <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest">24 Matches Identified</p>
                </div>
                <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input placeholder="Search roles..." className="bg-transparent pl-10 pr-4 py-2.5 rounded-xl text-sm font-medium w-64 focus:outline-none text-gray-900 placeholder:text-gray-300" />
                    </div>
                    <button className="bg-[#4285F4] text-white px-6 py-2.5 rounded-xl text-xs font-bold shadow-sm hover:bg-[#3b78e7] transition-all">Filter</button>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {[
                    { id: 1, company: "Google", role: "UX Engineer", match: 98, location: "Mountain View, CA", salary: "$180k – $240k", tags: ["Full-time", "Hybrid"] },
                    { id: 2, company: "Meta", role: "Product Designer", match: 94, location: "Menlo Park, CA", salary: "$190k – $260k", tags: ["Remote", "L5"] },
                    { id: 3, company: "Stripe", role: "Software Engineer", match: 89, location: "San Francisco, CA", salary: "$160k – $210k", tags: ["Remote", "Staff"] },
                    { id: 4, company: "Airbnb", role: "Frontend Lead", match: 82, location: "Remote", salary: "$190k – $250k", tags: ["Remote", "Senior"] },
                ].map((job, i) => (
                    <motion.div
                        key={job.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-white p-10 rounded-[40px] border border-gray-100 google-shadow flex flex-col justify-between group cursor-pointer relative overflow-hidden transition-all hover:border-[#4285F4]/30"
                    >
                        <div>
                            <div className="flex justify-between items-start mb-8">
                                <div className="w-16 h-16 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-center text-2xl font-black text-[#4285F4] shadow-sm">{job.company[0]}</div>
                                <div className="flex flex-col items-end gap-2">
                                    <span className="text-[9px] font-bold text-[#34A853] bg-[#34A853]/5 px-4 py-2 rounded-full border border-[#34A853]/10 tracking-widest uppercase">{job.match}% MATCH</span>
                                    <div className="flex gap-2">
                                        {job.tags.map(tag => (
                                            <span key={tag} className="text-[10px] font-bold text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100 uppercase tracking-widest">{tag}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">{job.role}</h3>
                            <p className="text-sm font-medium text-gray-500 mb-10 flex items-center gap-2">{job.company} <span className="w-1 h-1 bg-gray-200 rounded-full" /> {job.location}</p>
                        </div>
                        <div className="flex items-center justify-between pt-8 border-t border-gray-100">
                            <span className="text-xl font-bold text-gray-900">{job.salary}</span>
                            <div className="flex items-center gap-3">
                                <button className="p-3 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-all text-[#4285F4]"><Zap className="w-5 h-5" /></button>
                                <button className="bg-[#4285F4] text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm hover:bg-[#3b78e7] transition-all">Apply</button>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );

    const renderIntelligence = () => (
        <div className="space-y-10 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-2 bg-white p-12 rounded-[40px] border border-gray-100 google-shadow">
                    <h3 className="text-2xl font-bold text-gray-900 mb-10 tracking-tight">Market Demand Index</h3>
                    <div className="h-80 w-full bg-gray-50 rounded-[32px] flex items-end justify-between p-10 gap-4 border border-gray-100">
                        {[40, 65, 45, 90, 85, 60, 95].map((h, i) => (
                            <motion.div
                                key={i}
                                initial={{ height: 0 }}
                                animate={{ height: `${h}%` }}
                                transition={{ delay: i * 0.1, duration: 1 }}
                                className="w-full bg-[#4285F4] rounded-t-xl relative group shadow-sm hover:bg-[#3b78e7] transition-all"
                            >
                                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white border border-gray-100 shadow-sm text-gray-900 text-[10px] font-bold px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all">{(h * 2.4).toFixed(1)}k</div>
                            </motion.div>
                        ))}
                    </div>
                    <div className="flex justify-between mt-6 text-[10px] font-bold text-gray-300 uppercase tracking-widest px-4">
                        <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span>
                    </div>
                </div>
                <div className="bg-white p-10 rounded-[40px] border border-gray-100 google-shadow flex flex-col justify-between">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 mb-8 tracking-tight">Trending Skills</h3>
                        <div className="space-y-4">
                            {[
                                { name: "Generative AI", demand: "+240%", color: "text-[#4285F4]" },
                                { name: "Cloud Architecture", demand: "+180%", color: "text-[#34A853]" },
                                { name: "Cybersecurity", demand: "+120%", color: "text-[#FBBC05]" },
                                { name: "System Design", demand: "+95%", color: "text-[#EA4335]" },
                            ].map((skill, i) => (
                                <div key={i} className="flex justify-between items-center p-5 bg-gray-50/50 border border-gray-100 rounded-2xl hover:bg-gray-50 transition-colors">
                                    <span className="font-bold text-gray-700 text-sm">{skill.name}</span>
                                    <span className={`font-bold ${skill.color} text-sm`}>{skill.demand}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <button className="w-full h-14 bg-gray-50 border border-gray-100 rounded-2xl text-[11px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all mt-10">Detailed analysis</button>
                </div>
            </div>
        </div>
    );

    const renderProfile = () => (
        <div className="max-w-4xl space-y-10 relative z-10">
            <div className="bg-white p-12 rounded-[40px] border border-gray-100 google-shadow">
                <div className="flex flex-col md:flex-row items-center gap-10 mb-12">
                    <div className="w-32 h-32 rounded-[32px] bg-gradient-to-br from-[#4285F4] to-[#34A853] flex items-center justify-center text-4xl font-bold text-white shadow-md relative group">
                        {user.name[0]}
                    </div>
                    <div className="text-center md:text-left">
                        <h3 className="text-4xl font-bold text-gray-900 mb-2 tracking-tight">{user.name}</h3>
                        <p className="text-lg font-medium text-gray-400 mb-6">{user.email}</p>
                        <div className="flex flex-wrap justify-center md:justify-start gap-3">
                            <span className="bg-gray-50 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest text-[#4285F4] border border-[#4285F4]/10">Software Engineer</span>
                            <span className="bg-gray-50 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest text-[#34A853] border border-[#34A853]/10">Verified profile</span>
                        </div>
                    </div>
                    <button className="md:ml-auto bg-[#4285F4] text-white px-8 py-3 rounded-2xl text-xs font-bold shadow-sm hover:bg-[#3b78e7] transition-all">Edit profile</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 border-t border-gray-100 pt-12">
                    <div className="space-y-4">
                        <label className="text-[10px] font-bold text-gray-300 uppercase tracking-widest ml-1">Career Objectives</label>
                        <textarea
                            className="w-full h-36 bg-gray-50 border border-gray-100 rounded-2xl p-5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#4285F4]/10 transition-all text-gray-700 placeholder:text-gray-200"
                            placeholder="Elevate technical leadership to Staff Level..."
                        />
                    </div>
                    <div className="space-y-8">
                        <div>
                            <label className="text-[10px] font-bold text-gray-300 uppercase tracking-widest ml-1 mb-4 block">Privacy settings</label>
                            <div className="flex items-center justify-between p-5 bg-gray-50/50 border border-gray-100 rounded-2xl">
                                <span className="font-bold text-gray-600 text-sm">Recruiter Visibility</span>
                                <div className="w-12 h-6 bg-[#34A853] rounded-full relative">
                                    <div className="absolute right-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow-sm" />
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-300 uppercase tracking-widest ml-1 mb-4 block">Interface preferences</label>
                            <div className="flex items-center justify-between p-5 bg-gray-50/50 border border-gray-100 rounded-2xl">
                                <span className="font-bold text-gray-600 text-sm">Light Mode Active</span>
                                <div className="w-12 h-6 bg-[#4285F4] rounded-full relative">
                                    <div className="absolute right-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow-sm" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderContent = () => {
        switch (activeTab) {
            case "Dashboard": return renderDashboard();
            case "Career AI": return renderCareerAI();
            case "Jobs": return renderJobs();
            case "Intelligence": return renderIntelligence();
            case "Profile": return renderProfile();
            default: return renderDashboard();
        }
    };


    return (
        <div className="flex h-screen bg-gray-50/50 text-gray-900 overflow-hidden font-sans">
            {/* SIDEBAR */}
            <aside className="w-72 bg-white border-r border-gray-100 flex flex-col p-8 z-50">
                <div className="flex items-center gap-3 mb-12 px-2">
                    <div className="bg-gradient-to-br from-[#4285F4] to-[#34A853] p-2 rounded-xl shadow-sm">
                        <Shield className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-xl font-bold tracking-tight text-gray-900">
                        Resume <span className="text-[#4285F4]">AI</span>
                    </span>
                </div>

                <nav className="flex-1 space-y-2">
                    {navItems.map((item) => (
                        <button
                            key={item.name}
                            onClick={() => setActiveTab(item.name)}
                            className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all group ${activeTab === item.name
                                ? "bg-[#4285F4] text-white shadow-md font-semibold"
                                : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                                }`}
                        >
                            <item.icon className={`w-5 h-5 transition-transform ${activeTab === item.name ? "scale-110" : "group-hover:scale-110"}`} />
                            <span className="text-sm tracking-tight">{item.name}</span>
                        </button>
                    ))}
                </nav>

                <div className="mt-auto pt-6 border-t border-gray-100">
                    <button onClick={logout} className="w-full h-12 flex items-center gap-3 px-5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all font-medium text-sm group">
                        <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <main className="flex-1 overflow-y-auto p-10 relative">
                <div className="flex justify-between items-center mb-10 relative z-10">
                    <div>
                        <motion.p
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="text-[10px] font-bold text-[#4285F4] mb-2 uppercase tracking-[0.2em]"
                        >
                            {activeTab}
                        </motion.p>
                        <motion.h1
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 }}
                            className="text-4xl font-bold tracking-tight text-gray-900"
                        >
                            {isProcessing ? PHASE_LABELS[phase] : activeTab === "Dashboard" ? `Welcome, ${user.name.split(" ")[0]}` : activeTab}
                        </motion.h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-gray-100 shadow-sm">
                            <div className="w-2 h-2 bg-[#34A853] rounded-full animate-pulse shadow-[0_0_8px_rgba(52,168,83,0.4)]" />
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                {isProcessing ? "Processing" : targetRole ? targetRole.split(" ").slice(0, 2).join(" ") : "Live"}
                            </span>
                        </div>
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.5 }}
                        className="pb-20"
                    >
                        {renderContent()}

                        {/* Summary footer — Dashboard only */}
                        {activeTab === "Dashboard" && (
                            <div className="mt-16 bg-white p-10 rounded-[40px] border border-gray-100 google-shadow flex flex-wrap items-center gap-16 relative overflow-hidden text-center justify-center translate-y-2">
                                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-[#4285F4]/10 to-transparent" />
                                {result ? (
                                    result.topMatches.map((m, i) => (
                                        <div key={m.jobRole} className="space-y-2">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">{m.jobRole}</span>
                                            <span className={`text-4xl font-black tracking-tighter leading-none ${i === 0 ? "text-[#4285F4]" : "text-gray-400"}`}>{m.percentage}%</span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="flex gap-20">
                                        <div className="space-y-2">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Core Match</span>
                                            <span className="text-4xl font-black text-[#34A853] tracking-tighter">—</span>
                                        </div>
                                        <div className="space-y-2">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Gap Analysis</span>
                                            <span className="text-4xl font-black text-[#EA4335] tracking-tighter">—</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </main>
        </div>
    );
}
