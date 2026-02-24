"use client";

import { useState } from "react";
import { mockUsers } from "@/mockUsers";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import { Brain, ArrowRight, Mail, Lock, ShieldCheck, AlertCircle } from "lucide-react";
import Layout from "@/components/Layout";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        setTimeout(() => {
            const foundUser = mockUsers.find(
                (u) => u.email === email && u.password === password
            );
            if (foundUser) {
                localStorage.setItem("token", "mock-token");
                localStorage.setItem("user", JSON.stringify(foundUser));
                router.push("/dashboard");
            } else {
                setError("Invalid email or password");
            }
            setLoading(false);
        }, 700);
    };

    return (
        <Layout>
            <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-6 bg-gray-50/50">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full max-w-[440px]"
                >
                    <div className="bg-white rounded-[32px] p-10 md:p-12 border border-gray-100 google-shadow relative overflow-hidden">
                        <div className="flex flex-col items-center mb-10">
                            <div className="bg-gradient-to-br from-[#4285F4] to-[#34A853] p-3 rounded-2xl shadow-sm mb-6">
                                <Brain className="w-8 h-8 text-white" />
                            </div>
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h1>
                            <p className="text-gray-500 text-sm">Sign in to continue to Resume AI</p>
                        </div>

                        <form onSubmit={handleLogin} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700 ml-1">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="email"
                                        placeholder="name@company.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full h-12 bg-white border border-gray-200 rounded-xl pl-12 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#4285F4]/10 focus:border-[#4285F4] transition-all"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700 ml-1">Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="password"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full h-12 bg-white border border-gray-200 rounded-xl pl-12 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#4285F4]/10 focus:border-[#4285F4] transition-all"
                                        required
                                    />
                                </div>
                            </div>

                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2"
                                >
                                    <AlertCircle className="w-4 h-4" />
                                    {error}
                                </motion.div>
                            )}

                            <button
                                disabled={loading}
                                className="w-full h-12 bg-[#4285F4] text-white flex items-center justify-center gap-2 rounded-xl text-sm font-bold shadow-sm hover:bg-[#3b78e7] transition-all disabled:opacity-50"
                            >
                                {loading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <span>Sign In</span>
                                        <ArrowRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="mt-8 pt-8 border-t border-gray-100 text-center">
                            <p className="text-gray-500 text-sm">
                                Don't have an account?{' '}
                                <Link href="/signup" className="text-[#4285F4] font-semibold hover:underline">Create one</Link>
                            </p>
                        </div>
                    </div>

                    <div className="mt-8 flex items-center justify-center gap-3 text-gray-300">
                        <ShieldCheck className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Secure session encrypted</span>
                    </div>
                </motion.div>
            </div>
        </Layout>
    );
}
