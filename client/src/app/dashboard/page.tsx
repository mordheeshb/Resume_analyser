"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    RadarChart, Radar, PolarGrid, PolarAngleAxis,
    ResponsiveContainer,
} from "recharts";
import {
    Brain, Rocket, FileText, CheckCircle2,
    Upload, LogOut, Target, Sparkles, TrendingUp,
    ChevronRight, LayoutDashboard, User, Settings, Briefcase, Zap, Search,
    ArrowUpRight, Info, CloudUpload, AlertTriangle, Trophy, Medal
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
    idle: "INIT_ANALYSIS",
    requesting_url: "REQUESTING_SECURE_URL...",
    uploading_s3: "UPLOADING_TO_S3...",
    analyzing: "DECRYPTING_DATA...",
    done: "INIT_ANALYSIS",
    error: "RETRY_ANALYSIS",
};

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
        <div className="h-screen flex items-center justify-center bg-background">
            <div className="w-12 h-12 border-4 border-ios-blue/20 border-t-ios-blue rounded-full animate-spin shadow-[0_0_15px_var(--ios-blue)]" />
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

        // Helper: POST to Lambda and unwrap the API Gateway proxy envelope
        async function callLambda(label: string, payload: object): Promise<any> {
            console.log(`[Lambda] ${label} →`, payload);
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
            console.log(`[Lambda] ${label} ← HTTP ${res.status}:`, rawText);
            if (!res.ok) {
                throw new Error(`Lambda ${label} HTTP ${res.status}: ${rawText || "(empty)"}`);
            }
            let outer: any;
            try { outer = JSON.parse(rawText); } catch { outer = {}; }
            // API Gateway proxy: outer.body is the real JSON string
            return typeof outer?.body === "string" ? JSON.parse(outer.body) : (outer?.body ?? outer);
        }

        try {
            // ── STEP 1: Get a pre-signed S3 upload URL ─────────────────────
            setPhase("requesting_url");
            setPhaseDetail("Requesting secure upload URL from Lambda...");

            const urlPayload = await callLambda("generateUploadUrl", {
                action: "generateUploadUrl",
                fileName: selectedFile.name,
                contentType: "application/pdf",
            });

            const uploadUrl: string = urlPayload?.uploadUrl ?? urlPayload?.upload_url ?? "";
            const fileKey: string = urlPayload?.fileKey ?? urlPayload?.file_key ?? "";

            console.log("[Lambda] uploadUrl:", uploadUrl, "| fileKey:", fileKey);

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

            // ── STEP 3: Ask Lambda to analyse the uploaded resume ───────────
            setPhase("analyzing");
            setPhaseDetail("Lambda is matching your skills against DynamoDB roles...");

            const analysisPayload = await callLambda("analyzeResume", {
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
            const topMatches = [...rawMatches].sort((a, b) => b.percentage - a.percentage).slice(0, 3);
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
        { name: "Career AI", icon: Brain },
        { name: "Jobs", icon: Briefcase },
        { name: "Intelligence", icon: TrendingUp },
        { name: "Profile", icon: Settings },
    ];

    // ─── Medal icons for top 3 ──────────────────────────────────────────────
    const rankIcons = [Trophy, Medal, Medal];
    const rankColors = ["text-[#FF9F0A]", "text-[#BFC0C0]", "text-[#CD7F32]"];

    // ─── Dashboard Tab ──────────────────────────────────────────────────────
    const renderDashboard = () => (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-12 relative z-10">
            {/* Left Column */}
            <section className="space-y-12">
                {/* Primary Match Ring */}
                <div className="glass-thick p-10 rounded-[48px] border border-panel-border ios-shadow-lg relative overflow-hidden group">
                    <div className="flex justify-between items-center mb-12">
                        <h2 className="text-[12px] font-black uppercase tracking-[0.3em] text-foreground/40 flex items-center gap-3">
                            <TrendingUp className="w-4 h-4 text-ios-blue glow-text" />
                            SKILL_MATCH_VECTOR
                        </h2>
                        {result && (
                            <span className="text-[10px] font-black text-[#32D74B] bg-[#32D74B]/10 px-4 py-2 rounded-full border border-[#32D74B]/20 tracking-widest">ALIGNED</span>
                        )}
                    </div>

                    <div className="flex flex-col md:flex-row items-center justify-around gap-12">
                        {/* Circular Activity Ring */}
                        <div className="relative w-64 h-64 flex items-center justify-center shrink-0">
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 200 200">
                                <circle cx="100" cy="100" r="85" fill="transparent" stroke="var(--panel-border)" strokeWidth="18" strokeLinecap="round" />
                                <motion.circle
                                    cx="100" cy="100" r="85" fill="transparent"
                                    stroke="var(--ios-blue)" strokeWidth="18" strokeDasharray={534}
                                    initial={{ strokeDashoffset: 534 }}
                                    animate={{ strokeDashoffset: 534 - (534 * (result?.primaryMatch?.percentage || 0)) / 100 }}
                                    transition={{ duration: 2.5, ease: [0.16, 1, 0.3, 1] }}
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div className="absolute flex flex-col items-center">
                                <motion.span
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    key={result?.primaryMatch?.percentage}
                                    className="text-6xl font-[1000] tracking-tighter text-foreground glow-text leading-none"
                                >
                                    {result?.primaryMatch?.percentage || 0}%
                                </motion.span>
                                <span className="text-[9px] font-[1000] uppercase tracking-[0.4em] text-foreground/30 mt-3 whitespace-nowrap">SYS_POWER_LEVEL</span>
                            </div>
                        </div>

                        {/* Radar */}
                        <div className="w-full h-72 md:w-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart data={result?.radarData || [
                                    { subject: "F", A: 30 }, { subject: "B", A: 40 },
                                    { subject: "C", A: 20 }, { subject: "T", A: 60 }, { subject: "S", A: 50 }
                                ]}>
                                    <PolarGrid stroke="var(--panel-border)" />
                                    <PolarAngleAxis dataKey="subject" tick={{ fill: "var(--foreground)", opacity: 0.4, fontSize: 11, fontWeight: "900" }} />
                                    <Radar name="Skills" dataKey="A" stroke="var(--ios-blue)" fill="var(--ios-blue)" fillOpacity={0.2} strokeWidth={4} />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="mt-14 p-8 bg-white/5 rounded-[32px] border border-white/5 flex items-start gap-5 transition-all group-hover:bg-white/[0.08]">
                        <Info className="w-6 h-6 text-[#0A84FF] shrink-0 mt-0.5" />
                        <p className="text-md text-white/70 leading-relaxed font-semibold">
                            {result?.insight || "Upload your PDF resume and click INIT_ANALYSIS to begin a quantum analysis of your professional trajectory."}
                        </p>
                    </div>
                </div>

                {/* ── Top 3 Job Matches ── */}
                {result && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-thick p-10 rounded-[48px] border border-white/5 ios-shadow-lg space-y-6"
                    >
                        <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/30 flex items-center gap-3 mb-8">
                            <Trophy className="w-4 h-4 text-[#FF9F0A]" />
                            TOP_3_QUANTUM_MATCHES
                        </h3>
                        {result.topMatches.map((match, i) => {
                            const RankIcon = rankIcons[i] || Medal;
                            return (
                                <motion.div
                                    key={match.jobRole}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.12 }}
                                    className={`flex items-center gap-6 p-7 rounded-[36px] border transition-all ${i === 0 ? "bg-[#0A84FF]/10 border-[#0A84FF]/20" : "bg-white/5 border-white/5 hover:bg-white/[0.08]"}`}
                                >
                                    <RankIcon className={`w-7 h-7 shrink-0 ${rankColors[i]}`} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-lg font-[1000] text-white tracking-tight truncate">{match.jobRole}</p>
                                        <p className="text-[11px] font-black text-white/30 uppercase tracking-widest mt-1">
                                            {match.matched.length} MATCHED · {match.missing.length} GAPS
                                        </p>
                                    </div>
                                    <div className="shrink-0 text-right">
                                        <span className={`text-2xl font-[1000] tracking-tighter ${i === 0 ? "text-[#0A84FF] glow-text" : "text-white/60"}`}>
                                            {match.percentage}%
                                        </span>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </motion.div>
                )}

                {/* Upload Zone */}
                <div className="glass-thick p-8 rounded-[40px] border border-white/5 group hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center justify-between mb-8 px-4">
                        <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/30 flex items-center gap-4">
                            <FileText className="w-5 h-5 text-[#BF5AF2]" />
                            DOSSIER_RECON
                        </h3>
                        {fileName && (
                            <button
                                onClick={() => { setFileName(""); setSelectedFile(null); setResult(null); setPhase("idle"); setErrorMsg(""); }}
                                className="text-[#FF453A] text-xs font-black uppercase tracking-widest hover:underline"
                            >
                                Purge Data
                            </button>
                        )}
                    </div>

                    <div
                        onClick={() => fileRef.current?.click()}
                        className={`border-2 border-dashed rounded-[32px] p-12 text-center cursor-pointer transition-all duration-500 ${fileName ? "border-[#0A84FF]/40 bg-[#0A84FF]/5" : "border-white/5 hover:border-[#0A84FF]/20 hover:bg-white/5"
                            }`}
                    >
                        <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleFile} />
                        {fileName ? (
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-20 h-20 bg-[#0A84FF]/20 rounded-3xl flex items-center justify-center text-[#0A84FF] shadow-[0_0_20px_rgba(10,132,255,0.2)]">
                                    <CheckCircle2 className="w-10 h-10" />
                                </div>
                                <span className="text-xl font-black text-white tracking-tight">{fileName}</span>
                                <span className="text-[11px] font-black text-[#0A84FF] uppercase tracking-[0.2em] glow-text">PDF_INTEGRITY_VERIFIED</span>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-5">
                                <div className="w-24 h-24 bg-white/5 rounded-[32px] flex items-center justify-center text-white/10 group-hover:text-[#0A84FF]/40 group-hover:scale-110 transition-all duration-500">
                                    <Upload className="w-12 h-12" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xl font-black text-foreground/60 leading-none">IMPORT_DOSSIER</p>
                                    <p className="text-[10px] font-black text-foreground/20 uppercase tracking-widest">PDF ONLY · MAX 10MB</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* Right Column */}
            <section className="space-y-12 h-fit">
                <div className="glass-thick p-12 rounded-[56px] border border-white/5 ios-shadow-lg relative overflow-hidden h-full">
                    <div className="flex justify-between items-start mb-14">
                        <div>
                            <h2 className="text-4xl font-[1000] tracking-tighter text-white mb-2 uppercase">CORE_OPTIMIZER</h2>
                            <p className="text-[11px] font-black text-white/20 uppercase tracking-[0.3em]">AWS Lambda · S3 · DynamoDB</p>
                        </div>
                        <div className="p-5 bg-[#5E5CE6] rounded-[28px] text-white shadow-[0_0_30px_rgba(94,92,230,0.3)]">
                            <CloudUpload className="w-8 h-8" />
                        </div>
                    </div>

                    {/* Phase progress indicator */}
                    {isProcessing && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="mb-10 p-6 bg-[#0A84FF]/10 border border-[#0A84FF]/20 rounded-[32px] space-y-4"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-5 h-5 border-2 border-[#0A84FF]/30 border-t-[#0A84FF] rounded-full animate-spin shrink-0" />
                                <div>
                                    <p className="text-sm font-[1000] text-[#0A84FF] uppercase tracking-wider">{PHASE_LABELS[phase]}</p>
                                    <p className="text-[11px] text-white/30 font-bold mt-0.5">{phaseDetail}</p>
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
                                            className={`h-1.5 flex-1 rounded-full transition-all duration-700 ${done ? "bg-[#32D74B]" :
                                                active ? "bg-[#0A84FF] animate-pulse" :
                                                    "bg-white/10"
                                                }`}
                                        />
                                    );
                                })}
                            </div>
                            <div className="flex justify-between text-[9px] font-[1000] text-white/20 uppercase tracking-widest px-0.5">
                                <span>1. SECURE_URL</span>
                                <span>2. S3_UPLOAD</span>
                                <span>3. AI_MATCH</span>
                            </div>
                        </motion.div>
                    )}

                    {/* Error state */}
                    {phase === "error" && errorMsg && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-10 p-6 bg-[#FF453A]/10 border border-[#FF453A]/20 rounded-[32px] flex items-start gap-4"
                        >
                            <AlertTriangle className="w-5 h-5 text-[#FF453A] shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-[1000] text-[#FF453A] uppercase tracking-wider">ANALYSIS_FAILED</p>
                                <p className="text-[12px] text-white/50 font-bold mt-1 leading-relaxed">{errorMsg}</p>
                            </div>
                        </motion.div>
                    )}

                    {/* Matched skills grid */}
                    <div className="space-y-6 mb-14">
                        <span className="text-[11px] font-black text-white/20 uppercase tracking-[0.3em] px-2 block">SKILL_ENHANCEMENT_MATRIX</span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <AnimatePresence mode="popLayout">
                                {result ? (
                                    result.primaryMatch.matched.slice(0, 4).map((skill: string, i: number) => (
                                        <motion.div
                                            key={skill}
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: i * 0.1 }}
                                            className="p-8 rounded-[36px] bg-white/5 border border-white/5 flex items-center justify-between group cursor-default hover:bg-white/[0.08] transition-all"
                                        >
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-[#32D74B] uppercase mb-2 tracking-widest">HIGH_IMPACT</span>
                                                <span className="text-lg font-black text-white/90 tracking-tight">{skill}</span>
                                            </div>
                                            <ArrowUpRight className="w-6 h-6 text-[#32D74B] opacity-20 group-hover:opacity-100 transition-all group-hover:translate-x-1 group-hover:-translate-y-1" />
                                        </motion.div>
                                    ))
                                ) : (
                                    [1, 2, 3, 4].map(i => (
                                        <div key={i} className="p-8 rounded-[36px] bg-white/5 animate-pulse min-h-[90px] border border-white/5" />
                                    ))
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* CTA Button */}
                    <button
                        onClick={handleAnalyze}
                        disabled={isProcessing || !selectedFile}
                        className="w-full h-24 bg-[#0A84FF] text-white flex items-center justify-center gap-5 rounded-[42px] text-2xl font-[1000] ios-shadow hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed tracking-tight shadow-[0_0_30px_rgba(10,132,255,0.3)]"
                    >
                        {isProcessing
                            ? PHASE_LABELS[phase]
                            : phase === "error"
                                ? "RETRY_ANALYSIS"
                                : "INIT_ANALYSIS"}
                        <Rocket className={`w-8 h-8 ${isProcessing ? "animate-bounce" : ""}`} />
                    </button>

                    {/* Roadmap */}
                    {result && (
                        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="mt-20 space-y-10">
                            <div className="flex items-center gap-4 mb-8">
                                <Target className="w-6 h-6 text-[#FF375F]" />
                                <h3 className="text-[12px] font-black uppercase tracking-[0.3em] text-white/30">OPERATIONAL_BLUEPRINT</h3>
                            </div>
                            <div className="space-y-5">
                                {result.roadmap.map((step: RoadmapStep, i: number) => (
                                    <div key={i} className="flex items-center gap-8 p-8 glass-thin rounded-[44px] border border-white/5 hover:bg-white/5 transition-colors">
                                        <div className="w-16 h-16 rounded-[22px] bg-[#050505] border border-white/10 flex items-center justify-center text-[#0A84FF] font-black text-2xl shadow-inner shadow-white/5">{i + 1}</div>
                                        <div className="flex-1">
                                            <p className="text-lg font-black text-white tracking-tight leading-tight mb-1">{step.step}</p>
                                            <p className="text-[12px] font-bold text-white/30">RECON: {step.cert}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-black text-[#32D74B] glow-text">{step.scoreGain}</p>
                                            <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">{step.timeEstimate}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </div>
            </section>
        </div>
    );

    const renderCareerAI = () => (
        <div className="space-y-12 relative z-10">
            <div className="glass-thick p-16 rounded-[64px] border border-white/5 ios-shadow-lg overflow-hidden relative">
                <div className="absolute top-0 right-0 w-96 h-96 bg-[#BF5AF2]/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2" />
                <h2 className="text-4xl font-[1000] mb-8 flex items-center gap-6 text-white tracking-tighter uppercase">
                    <Sparkles className="w-12 h-12 text-[#BF5AF2] glow-text" />
                    NEURAL_INTELLIGENCE
                </h2>
                <p className="text-white/50 max-w-2xl text-xl mb-16 leading-relaxed font-medium">
                    AWS Lambda powered matching engine — pdfminer extracts text from your PDF, then
                    compares it against every role stored in DynamoDB to surface your top career alignments.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                    {[
                        { title: "PDFMINER_EXTRACT", value: "Text Extraction", icon: FileText, color: "text-[#0A84FF]" },
                        { title: "DYNAMODB_MATCH", value: "All Roles Scanned", icon: TrendingUp, color: "text-[#32D74B]" },
                        { title: "TOP_3_OUTPUT", value: "Best Fit Roles", icon: Zap, color: "text-[#FF9F0A]" },
                    ].map((item, i) => (
                        <div key={i} className="glass-regular p-10 rounded-[44px] border border-white/5 group hover:bg-white/[0.08] transition-all duration-500">
                            <item.icon className={`w-10 h-10 ${item.color} mb-6`} />
                            <h4 className="text-[11px] font-black text-white/30 uppercase tracking-[0.3em] mb-2">{item.title}</h4>
                            <p className="text-2xl font-[1000] text-white tracking-tight">{item.value}</p>
                        </div>
                    ))}
                </div>
            </div>
            {result ? renderDashboard() : (
                <div className="flex flex-col items-center justify-center p-32 glass-thick rounded-[64px] border border-white/5 text-center">
                    <div className="w-32 h-32 bg-white/5 rounded-[40px] flex items-center justify-center mb-10 border border-white/10 group">
                        <Brain className="w-16 h-16 text-[#0A84FF]/40 group-hover:scale-110 transition-transform duration-700" />
                    </div>
                    <h3 className="text-3xl font-[1000] mb-3 text-white tracking-tight uppercase">NO_SIGNAL_FOUND</h3>
                    <p className="text-white/30 max-w-sm text-lg font-medium">Upload a PDF resume on the Dashboard tab to aggregate AI-driven intelligence.</p>
                </div>
            )}
        </div>
    );

    const renderJobs = () => (
        <div className="space-y-12 relative z-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-10 mb-16">
                <div>
                    <h2 className="text-5xl font-[1000] text-white tracking-tighter mb-4 uppercase">QUANTUM_MATCHES</h2>
                    <p className="text-white/30 font-black text-[12px] uppercase tracking-[0.3em] leading-none">24 RELEVANT_NODES_IDENTIFIED</p>
                </div>
                <div className="flex items-center gap-4 glass-thick p-3 rounded-[36px] border border-white/5 ios-shadow">
                    <div className="relative">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
                        <input placeholder="FIND_POSITION..." className="bg-transparent pl-16 pr-8 py-5 rounded-3xl text-sm font-black w-80 focus:outline-none text-white uppercase tracking-widest placeholder:text-white/10" />
                    </div>
                    <button className="ios-btn-primary !py-5 !px-10 !text-[12px] !tracking-[0.2em] !font-black uppercase">EXEC_FILTER</button>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                {[
                    { id: 1, company: "OpenAI", role: "Principal Frontend Engineer", match: 98, location: "San Francisco, CA", salary: "$250k – $320k", tags: ["Remote", "L6"] },
                    { id: 2, company: "Apple", role: "UI/UX System Design", match: 94, location: "Cupertino, CA", salary: "$190k – $260k", tags: ["On-site", "ICT4"] },
                    { id: 3, company: "Stripe", role: "Full Stack Financial Systems", match: 89, location: "Remote", salary: "$210k – $280k", tags: ["Remote", "Staff"] },
                    { id: 4, company: "SpaceX", role: "Mission Control Software", match: 82, location: "Hawthorne, CA", salary: "$180k – $240k", tags: ["On-site", "Senior"] },
                ].map((job, i) => (
                    <motion.div
                        key={job.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.1 }}
                        className="glass-thick p-12 rounded-[56px] border border-white/5 ios-shadow-lg flex flex-col justify-between group cursor-pointer relative overflow-hidden active:scale-[0.98] transition-all"
                    >
                        <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-[#0A84FF]/10 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                        <div>
                            <div className="flex justify-between items-start mb-10">
                                <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-[28px] flex items-center justify-center text-3xl font-[1000] text-white shadow-xl">{job.company[0]}</div>
                                <div className="flex flex-col items-end gap-3">
                                    <span className="text-[11px] font-black text-[#32D74B] bg-[#32D74B]/10 px-5 py-2.5 rounded-full border border-[#32D74B]/20 tracking-[0.2em] uppercase">MATCH_{job.match}%</span>
                                    <div className="flex gap-2">
                                        {job.tags.map(tag => (
                                            <span key={tag} className="text-[10px] font-black text-white/30 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 uppercase tracking-widest">{tag}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <h3 className="text-3xl font-[1000] text-white underline-offset-8 group-hover:underline mb-3 tracking-tighter uppercase">{job.role}</h3>
                            <p className="text-xl font-bold text-white/40 mb-12 flex items-center gap-3">{job.company} <span className="w-1.5 h-1.5 bg-white/10 rounded-full" /> {job.location}</p>
                        </div>
                        <div className="flex items-center justify-between pt-10 border-t border-white/5">
                            <span className="text-2xl font-[1000] text-[#0A84FF] glow-text">{job.salary}</span>
                            <div className="flex items-center gap-4">
                                <button className="p-5 rounded-2xl glass-thin border border-white/5 hover:bg-white/10 transition-all text-[#BF5AF2]"><Sparkles className="w-6 h-6" /></button>
                                <button className="ios-btn-primary !py-4 !px-8 flex items-center gap-3 uppercase font-black text-[12px] tracking-widest">APPLY_NOW <ArrowUpRight className="w-5 h-5" /></button>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );

    const renderIntelligence = () => (
        <div className="space-y-12 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-2 glass-thick p-16 rounded-[64px] border border-white/5 ios-shadow-lg">
                    <h3 className="text-3xl font-[1000] text-white mb-12 uppercase tracking-tight">MARKET_VELOCITY_INDEX</h3>
                    <div className="h-96 w-full bg-white/5 rounded-[44px] flex items-end justify-between p-12 gap-6 border border-white/5">
                        {[40, 65, 45, 90, 85, 60, 95].map((h, i) => (
                            <motion.div
                                key={i}
                                initial={{ height: 0 }}
                                animate={{ height: `${h}%` }}
                                transition={{ delay: i * 0.1, duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                                className="w-full bg-gradient-to-t from-[#0A84FF] to-[#5E5CE6] rounded-2xl relative group shadow-[0_0_20px_rgba(10,132,255,0.2)] hover:shadow-[0_0_40px_rgba(10,132,255,0.4)] transition-all"
                            >
                                <div className="absolute -top-12 left-1/2 -translate-x-1/2 glass-thin text-white text-[11px] font-black px-3 py-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-all">{(h * 2.4).toFixed(1)}k</div>
                            </motion.div>
                        ))}
                    </div>
                    <div className="flex justify-between mt-8 text-[11px] font-[1000] text-white/20 uppercase tracking-[0.4em] px-4">
                        <span>JAN</span><span>FEB</span><span>MAR</span><span>APR</span><span>MAY</span><span>JUN</span><span>JUL</span>
                    </div>
                </div>
                <div className="glass-thick p-12 rounded-[64px] border border-white/5 ios-shadow-lg flex flex-col justify-between">
                    <div>
                        <h3 className="text-2xl font-[1000] text-white mb-10 uppercase tracking-tight">HOT_STACK</h3>
                        <div className="space-y-5">
                            {[
                                { name: "Generative AI", demand: "+240%", color: "text-[#BF5AF2]" },
                                { name: "Rust / Systems", demand: "+180%", color: "text-[#FF9F0A]" },
                                { name: "Cloud Native", demand: "+120%", color: "text-[#0A84FF]" },
                                { name: "Cybersecurity", demand: "+95%", color: "text-[#32D74B]" },
                            ].map((skill, i) => (
                                <div key={i} className="flex justify-between items-center p-6 glass-thin border border-white/5 rounded-[32px] hover:bg-white/5 transition-colors">
                                    <span className="font-black text-white/80 text-lg uppercase tracking-tight">{skill.name}</span>
                                    <span className={`font-[1000] ${skill.color} tracking-tighter text-xl`}>{skill.demand}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <button className="w-full h-20 glass-thin border border-white/10 rounded-[32px] text-[13px] font-[1000] uppercase tracking-[0.3em] text-white/60 hover:text-white hover:bg-white/5 transition-all mt-10">ACCESS_FULL_INTEL</button>
                </div>
            </div>
        </div>
    );

    const renderProfile = () => (
        <div className="max-w-4xl space-y-12 relative z-10">
            <div className="glass-thick p-16 rounded-[64px] border border-white/5 ios-shadow-lg">
                <div className="flex flex-col md:flex-row items-center gap-12 mb-16">
                    <div className="w-40 h-40 rounded-[48px] bg-gradient-to-br from-[#0A84FF] to-[#5E5CE6] flex items-center justify-center text-5xl font-[1000] text-white shadow-2xl shadow-[#0A84FF]/30 relative group">
                        {user.name[0]}
                        <div className="absolute inset-0 bg-white/20 rounded-[48px] opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
                    </div>
                    <div className="text-center md:text-left">
                        <h3 className="text-5xl font-[1000] text-white mb-3 tracking-tighter uppercase">{user.name}</h3>
                        <p className="text-xl font-black text-white/30 mb-8 tracking-tight">{user.email}</p>
                        <div className="flex flex-wrap justify-center md:justify-start gap-4">
                            <span className="glass-thin px-6 py-2.5 rounded-full text-[11px] font-black uppercase tracking-[0.3em] text-[#0A84FF] border border-[#0A84FF]/20">CORE_ARCHITECT</span>
                            <span className="glass-thin px-6 py-2.5 rounded-full text-[11px] font-black uppercase tracking-[0.3em] text-[#BF5AF2] border border-[#BF5AF2]/20">ELITE_STATUS</span>
                            <span className="glass-thin px-6 py-2.5 rounded-full text-[11px] font-black uppercase tracking-[0.3em] text-[#32D74B] border border-[#32D74B]/20">VERIFIED</span>
                        </div>
                    </div>
                    <button className="md:ml-auto ios-btn-primary !py-5 !px-10 !text-[12px] !tracking-[0.2em] !font-black uppercase shadow-xl hover:scale-105 transition-all">EDIT_IDENTITY</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 border-t border-white/5 pt-16">
                    <div className="space-y-8">
                        <label className="text-[11px] font-black text-white/30 uppercase tracking-[0.4em] ml-2">MISSION_OBJECTIVES</label>
                        <textarea
                            className="w-full h-48 bg-white/5 border border-white/5 rounded-[44px] p-8 text-lg font-bold focus:outline-none focus:ring-4 focus:ring-[#0A84FF]/20 transition-all text-white placeholder:text-white/10 leading-relaxed"
                            placeholder="Elevate technical leadership to Staff Level within 18 months..."
                        />
                    </div>
                    <div className="space-y-10">
                        <div>
                            <label className="text-[11px] font-black text-white/30 uppercase tracking-[0.4em] ml-2 mb-6 block">PRIVACY_SHIELD</label>
                            <div className="flex items-center justify-between p-6 glass-thin border border-white/5 rounded-[32px] hover:bg-white/5 transition-colors">
                                <span className="font-black text-white/70 uppercase tracking-tight">Recruiter Stealth Mode</span>
                                <div className="w-14 h-8 bg-[#32D74B] rounded-full relative shadow-inner shadow-black/20">
                                    <div className="absolute right-1 top-1 w-6 h-6 bg-white rounded-full shadow-lg" />
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="text-[11px] font-black text-white/30 uppercase tracking-[0.4em] ml-2 mb-6 block">INTERFACE_MODE</label>
                            <div className="flex items-center justify-between p-6 glass-thin border border-white/5 rounded-[32px] hover:bg-white/5 transition-colors">
                                <span className="font-black text-white/70 uppercase tracking-tight">Quantum High Contrast</span>
                                <div className="w-14 h-8 bg-[#0A84FF] rounded-full relative shadow-inner shadow-black/20">
                                    <div className="absolute right-1 top-1 w-6 h-6 bg-white rounded-full shadow-lg" />
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
        <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans selection:bg-[#0A84FF]/30">
            <div className="mesh-gradient opacity-40" />

            {/* SIDEBAR */}
            <aside className="w-80 glass-thick border-r border-white/5 flex flex-col p-10 z-50">
                <div className="flex items-center gap-5 mb-16 px-2">
                    <div className="bg-gradient-to-br from-ios-blue to-ios-indigo p-3 rounded-[22px] ios-shadow text-white shadow-[0_0_20px_rgba(var(--ios-blue),0.3)]">
                        <Brain className="w-7 h-7" />
                    </div>
                    <span className="font-black text-2xl tracking-tighter text-foreground">PROWESS.AI</span>
                </div>

                <nav className="flex-1 space-y-3">
                    {navItems.map((item) => (
                        <button
                            key={item.name}
                            onClick={() => setActiveTab(item.name)}
                            className={`w-full flex items-center gap-5 px-6 py-4 rounded-[24px] transition-all duration-300 group ${activeTab === item.name
                                ? "bg-[#0A84FF] text-white ios-shadow-sm font-black"
                                : "text-white/30 hover:text-white/70 hover:bg-white/5"
                                }`}
                        >
                            <item.icon className={`w-6 h-6 transition-transform duration-300 ${activeTab === item.name ? "scale-110" : "group-hover:scale-105"}`} />
                            <span className="text-[16px] tracking-tight">{item.name}</span>
                        </button>
                    ))}
                </nav>

                <div className="mt-auto pt-10 border-t border-panel-border">
                    <button onClick={logout} className="w-full flex items-center gap-5 px-6 py-5 text-foreground/30 hover:text-ios-red transition-colors font-black group text-sm tracking-widest text-left">
                        <LogOut className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
                        SYSTEM_EXIT
                    </button>
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <main className="flex-1 overflow-y-auto p-16 relative">
                <div className="flex justify-between items-end mb-16 relative z-10">
                    <div>
                        <motion.p
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="text-[12px] font-black text-ios-blue mb-4 uppercase tracking-[0.4em] glow-text"
                        >
                            {activeTab} INTEGRITY_NODE
                        </motion.p>
                        <motion.h1
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 }}
                            className="text-6xl font-[1000] tracking-tighter text-white uppercase"
                        >
                            {isProcessing ? PHASE_LABELS[phase] : activeTab === "Dashboard" ? `Welcome, ${user.name.split(" ")[0]}` : activeTab}
                        </motion.h1>
                    </div>
                    <div className="flex items-center gap-8 mb-2">
                        <div className="hidden md:flex items-center gap-4 glass-thin px-6 py-3 rounded-2xl border border-white/5 shadow-inner shadow-white/5">
                            <div className="w-2.5 h-2.5 bg-[#32D74B] rounded-full animate-pulse shadow-[0_0_10px_rgba(50,215,75,0.5)]" />
                            <span className="text-[11px] font-[1000] text-white/40 uppercase tracking-[0.2em]">
                                {isProcessing ? "PROCESSING" : "SYSTEM_ACTIVE"}
                            </span>
                        </div>
                        <div className="w-16 h-16 rounded-[24px] glass-thick border border-white/10 flex items-center justify-center ios-shadow cursor-pointer hover:scale-105 active:scale-95 transition-all group overflow-hidden relative">
                            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <User className="w-8 h-8 text-white/40 group-hover:text-white transition-colors" />
                        </div>
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -30 }}
                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                        className="pb-32"
                    >
                        {renderContent()}

                        {/* Role stats footer — Dashboard only */}
                        {activeTab === "Dashboard" && (
                            <div className="mt-24 glass-thick p-12 rounded-[64px] border border-white/5 flex flex-wrap items-center gap-16 ios-shadow-lg relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#0A84FF]/20 to-transparent" />
                                <div className="flex gap-24 px-8 w-full justify-center">
                                    {result ? (
                                        result.topMatches.map((m, i) => (
                                            <div key={m.jobRole} className="space-y-3 text-center">
                                                <span className="text-[11px] font-black text-foreground/20 uppercase tracking-[0.3em] block truncate max-w-[120px]">{m.jobRole.split(" ")[0]}</span>
                                                <span className={`text-5xl font-[1000] tracking-tighter leading-none glow-text ${rankColors[i]}`}>{m.percentage}%</span>
                                            </div>
                                        ))
                                    ) : (
                                        <>
                                            <div className="space-y-3 text-center">
                                                <span className="text-[12px] font-black text-foreground/20 uppercase tracking-[0.4em] block">MATCHED</span>
                                                <span className="text-6xl font-[1000] text-ios-green tracking-tighter leading-none glow-text">—</span>
                                            </div>
                                            <div className="space-y-3 text-center">
                                                <span className="text-[12px] font-black text-foreground/20 uppercase tracking-[0.4em] block">GAPS</span>
                                                <span className="text-6xl font-[1000] text-ios-red tracking-tighter leading-none glow-text">—</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </main>
        </div>
    );
}
