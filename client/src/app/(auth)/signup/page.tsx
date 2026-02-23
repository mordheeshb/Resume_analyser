"use client";

import { useState } from "react";
import { mockUsers, MockUser } from "@/mockUsers";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import { Brain, ArrowRight, Mail, Lock, User, ShieldCheck, Sparkles, AlertCircle } from "lucide-react";

export default function SignupPage() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();

    const handleSignup = (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        setTimeout(() => {
            const exists = mockUsers.some((u: MockUser) => u.email === email);
            if (exists) {
                setError("Email already registered");
                setLoading(false);
                return;
            }
            const newUser: MockUser = { name, email, password };
            mockUsers.push(newUser);
            localStorage.setItem("token", "mock-token");
            localStorage.setItem("user", JSON.stringify(newUser));
            router.push("/dashboard");
            setLoading(false);
        }, 700);
    };

    return (
        <div className="min-h-screen relative flex items-center justify-center p-6 bg-background overflow-hidden selection:bg-[#BF5AF2]/30">
            <div className="mesh-gradient opacity-40" />

            <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-[480px] z-10"
            >
                <div className="glass-thick rounded-[48px] p-12 border border-white/10 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-[#BF5AF2]/5 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2" />

                    <div className="flex flex-col items-center mb-12 relative z-10">
                        <div className="w-24 h-24 bg-gradient-to-br from-[#BF5AF2] to-[#5E5CE6] rounded-[32px] flex items-center justify-center ios-shadow text-white mb-8 shadow-[0_0_30px_rgba(191,90,242,0.3)]">
                            <Sparkles className="w-12 h-12" />
                        </div>
                        <h1 className="text-4xl font-[1000] tracking-tighter text-foreground mb-3 text-center uppercase">CREATE_ID</h1>
                        <p className="text-foreground/40 text-[13px] font-black uppercase tracking-[0.3em]">INIT_QUANUM_SYNC</p>
                    </div>

                    <form onSubmit={handleSignup} className="space-y-6 relative z-10">
                        <div className="space-y-3">
                            <label className="text-[11px] font-[1000] text-foreground/30 ml-2 uppercase tracking-[0.4em]">IDENTITY_LABEL</label>
                            <div className="relative group">
                                <User className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-[#BF5AF2] transition-all" />
                                <input
                                    type="text"
                                    placeholder="LEGAL_NAME..."
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full h-16 bg-white/5 border border-panel-border rounded-[24px] pl-16 pr-6 text-base font-bold outline-none focus:ring-4 focus:ring-[#BF5AF2]/10 focus:border-[#BF5AF2]/40 transition-all text-foreground placeholder:text-foreground/10 uppercase tracking-tight"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[11px] font-[1000] text-white/30 ml-2 uppercase tracking-[0.4em]">COMM_ADDRESS</label>
                            <div className="relative group">
                                <Mail className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-[#BF5AF2] transition-all" />
                                <input
                                    type="email"
                                    placeholder="NETWORK_EMAIL..."
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full h-16 bg-white/5 border border-white/5 rounded-[24px] pl-16 pr-6 text-base font-bold outline-none focus:ring-4 focus:ring-[#BF5AF2]/10 focus:border-[#BF5AF2]/40 transition-all text-white placeholder:text-white/10 uppercase tracking-tight"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[11px] font-[1000] text-white/30 ml-2 uppercase tracking-[0.4em]">ENCRYPTION_KEY</label>
                            <div className="relative group">
                                <Lock className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-[#BF5AF2] transition-all" />
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full h-16 bg-white/5 border border-white/5 rounded-[24px] pl-16 pr-6 text-base font-bold outline-none focus:ring-4 focus:ring-[#BF5AF2]/10 focus:border-[#BF5AF2]/40 transition-all text-white placeholder:text-white/10"
                                    required
                                />
                            </div>
                        </div>

                        {error && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-[#FF453A]/10 border border-[#FF453A]/20 text-[#FF453A] px-6 py-4 rounded-[24px] text-xs font-black uppercase tracking-widest flex items-center gap-3">
                                <AlertCircle className="w-4 h-4" />
                                {error}
                            </motion.div>
                        )}

                        <button
                            disabled={loading}
                            className="w-full h-16 bg-gradient-to-br from-[#BF5AF2] to-[#5E5CE6] text-white flex items-center justify-center gap-4 rounded-[28px] text-[15px] font-[1000] uppercase tracking-[0.3em] shadow-[0_0_30px_rgba(191,90,242,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all mt-4 disabled:opacity-50"
                        >
                            {loading ? (
                                <div className="w-6 h-6 border-[3px] border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <span>ACTIVATE_SYNC</span>
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-12 pt-10 border-t border-white/5 text-center relative z-10">
                        <p className="text-white/30 font-bold text-sm tracking-tight">
                            ALREADY_ACTIVE?{" "}
                            <Link href="/login" className="text-[#BF5AF2] font-black hover:underline uppercase tracking-widest ml-1">RESUME_ID</Link>
                        </p>
                    </div>
                </div>

                <div className="mt-12 flex flex-col items-center gap-3 text-white/20">
                    <div className="flex items-center gap-3">
                        <ShieldCheck className="w-5 h-5" />
                        <span className="text-[11px] font-black uppercase tracking-[0.5em] text-center">QUANTUM_SECURE_PROTOCOL</span>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
