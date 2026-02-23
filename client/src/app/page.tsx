"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Brain, Rocket, Award, ShieldCheck, ArrowRight, Zap, Target } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-[#0A84FF]/30 font-sans overflow-hidden">
      {/* Dark Mesh Gradient */}
      <div className="mesh-gradient opacity-40" />

      {/* Navigation */}
      <nav className="max-w-7xl mx-auto px-8 py-10 flex justify-between items-center glass-thick rounded-[32px] border border-white/5 sticky top-6 z-50 mx-6 ios-shadow-lg">
        <div className="flex items-center gap-4 text-3xl font-[1000] tracking-tighter">
          <div className="bg-gradient-to-br from-[#0A84FF] to-[#5E5CE6] p-2 rounded-xl shadow-[0_0_15px_rgba(10,132,255,0.4)]">
            <Brain className="w-8 h-8 text-white" />
          </div>
          PROWESS.AI
        </div>
        <div className="hidden md:flex gap-10 font-black text-[11px] uppercase tracking-[0.3em] text-white/30">
          <Link href="#features" className="hover:text-white transition-colors">CAPABILITIES</Link>
          <Link href="#methodology" className="hover:text-white transition-colors">INTEL_LOGIC</Link>
          <Link href="#enterprise" className="hover:text-white transition-colors">CLUSTER_ACCESS</Link>
        </div>
        <div className="flex gap-6">
          <Link href="/login">
            <button className="px-8 py-3 text-sm font-black uppercase tracking-widest text-white/60 hover:text-white transition-all">SYSTEM_ENTRY</button>
          </Link>
          <Link href="/signup">
            <button className="px-8 py-3 bg-[#0A84FF] text-white text-sm font-black rounded-2xl hover:shadow-[0_0_25px_rgba(10,132,255,0.4)] hover:scale-105 transition-all uppercase tracking-widest">INIT_ID</button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-48 px-8 overflow-hidden">
        <div className="absolute top-20 right-0 w-[800px] h-[800px] bg-[#0A84FF]/5 rounded-full blur-[150px] -z-10 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] bg-[#BF5AF2]/5 rounded-full blur-[150px] -z-10"></div>

        <div className="max-w-6xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="inline-block px-6 py-2 rounded-full glass-thin border border-[#0A84FF]/20 text-[#0A84FF] text-[10px] font-black tracking-[0.4em] uppercase mb-10 glow-text"
          >
            QUANTUM_ENGINE_V.4.2_ACTIVE
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="text-7xl md:text-9xl font-[1000] tracking-tighter leading-[0.85] mb-12 uppercase"
          >
            DECRYPT YOUR <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0A84FF] via-[#5E5CE6] to-[#BF5AF2] animate-gradient-x">CAREER_DNA.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="text-2xl text-white/40 max-w-3xl mx-auto mb-16 font-medium leading-relaxed"
          >
            Execute high-fidelity skill normalization and match with elite industry nodes
            using the world's most advanced AI matching architecture.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="flex flex-col md:flex-row gap-8 justify-center items-center"
          >
            <Link href="/signup">
              <button className="px-12 py-6 bg-white text-black text-xl font-[1000] rounded-[24px] flex items-center gap-4 group hover:shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:-translate-y-1 transition-all uppercase tracking-tight">
                EXEC_ANALYSIS <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
              </button>
            </Link>
            <div className="flex flex-col items-center md:items-start gap-2">
              <div className="flex -space-x-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="w-12 h-12 rounded-full border-[3px] border-[#050505] bg-white/10 flex items-center justify-center text-[10px] font-black glass-thin">ID</div>
                ))}
              </div>
              <div className="text-[11px] font-black text-white/20 uppercase tracking-[0.2em]">+ 12.4k OPERATIONAL_NODES</div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Feature Grid */}
      <section id="features" className="py-48 relative border-t border-white/5">
        <div className="max-w-7xl mx-auto px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              { icon: <Zap className="w-8 h-8 text-[#FF9F0A]" />, title: "NEUTRON_SYNC", desc: "Normalization of 50k+ skill variants in under 800ms." },
              { icon: <Target className="w-8 h-8 text-[#0A84FF]" />, title: "CORE_MATCH", desc: "Cluster-based alignment with Fortune 500 technical stacks." },
              { icon: <Rocket className="w-8 h-8 text-[#BF5AF2]" />, title: "ORBITAL_PATH", desc: "Automated career trajectory generation via recursive LLM analysis." }
            ].map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                whileHover={{ y: -15, backgroundColor: "rgba(255,255,255,0.04)" }}
                className="glass-thick p-14 rounded-[56px] border border-white/5 transition-all duration-700 hover:border-white/10 group"
              >
                <div className="w-20 h-20 bg-white/5 rounded-[28px] flex items-center justify-center mb-10 border border-white/5 group-hover:scale-110 transition-transform duration-700 shadow-inner shadow-white/5">
                  {f.icon}
                </div>
                <h3 className="text-3xl font-[1000] mb-6 uppercase tracking-tight">{f.title}</h3>
                <p className="text-white/40 leading-relaxed text-lg font-medium">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-48 px-8 border-t border-white/5">
        <div className="max-w-7xl mx-auto rounded-[64px] bg-gradient-to-br from-[#0A84FF] to-[#0A84FF]/20 p-24 md:p-32 text-center text-white relative overflow-hidden ios-shadow-lg">
          <div className="absolute inset-0 opacity-10 mix-blend-overlay bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 blur-[100px] rounded-full"></div>

          <h2 className="text-5xl md:text-7xl font-[1000] mb-12 relative z-10 uppercase tracking-tighter">ELIMINATE_UNCERTAINTY.</h2>
          <p className="text-2xl text-white/70 mb-16 max-w-2xl mx-auto relative z-10 font-medium italic">Join the elite engineering 0.1% who use Prowess.AI to dominate technical matching.</p>
          <Link href="/signup">
            <button className="px-14 py-7 bg-white text-[#0A84FF] text-2xl font-[1000] rounded-full hover:scale-110 shadow-2xl transition-all relative z-10 uppercase tracking-tight">
              INIT_FREE_VECTORS
            </button>
          </Link>
        </div>
      </section>

      <footer className="py-20 px-8 border-t border-white/5 text-center text-white/10 text-[10px] font-black uppercase tracking-[0.5em]">
        © 2026 PROWESS.AI // CORE_ENGINE_V.4.2 // SECURE_NODE_ALPHA
      </footer>
    </div>
  );
}
