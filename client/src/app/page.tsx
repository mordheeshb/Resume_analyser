"use client";

import Layout from "../components/Layout";
import { motion } from "framer-motion";
import { ArrowRight, Zap, Target, Rocket, Upload, BarChart3, CheckCircle } from "lucide-react";
import Link from "next/link";

export default function LandingPage() {
  return (
    <Layout>
      <div className="relative z-10">
        {/* ================= HERO ================= */}
        <section className="pt-24 pb-20 px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl mx-auto"
          >
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-gray-900 mb-8">
              Smarter Resume Analysis <br />
              <span className="text-gradient">
                Powered by AI
              </span>
            </h1>

            <p className="text-lg md:text-xl text-gray-500 max-w-2xl mx-auto mb-12 leading-relaxed">
              Understand your strengths, fix your gaps, and get a personalized
              roadmap to land better opportunities — faster.
            </p>

            <div className="flex justify-center gap-4 flex-wrap">
              <Link href="/signup">
                <button className="px-8 py-4 bg-[#202124] text-white rounded-full text-lg font-medium shadow-lg hover:bg-black transition-all flex items-center gap-3 group">
                  Analyze My Resume <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </Link>

              <Link href="#how">
                <button className="px-8 py-4 bg-white border border-gray-200 rounded-full text-lg font-medium hover:bg-gray-50 transition-all">
                  See How It Works
                </button>
              </Link>
            </div>
          </motion.div>
        </section>

        {/* ================= TRUST SECTION ================= */}
        <section className="py-12 text-center border-y border-gray-50 bg-gray-50/30">
          <p className="text-sm font-medium text-gray-400 mb-6 uppercase tracking-widest">
            Empowering professionals worldwide
          </p>
          <div className="flex flex-wrap justify-center gap-12 text-gray-400 font-medium">
            <div className="flex flex-col items-center">
              <span className="text-2xl text-gray-900">10,000+</span>
              <span className="text-xs">Resumes Analyzed</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-2xl text-gray-900">95%</span>
              <span className="text-xs">Accuracy Rate</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-2xl text-gray-900">Elite</span>
              <span className="text-xs">Career Insights</span>
            </div>
          </div>
        </section>

        {/* ================= FEATURES ================= */}
        <section id="features" className="py-32 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Powerful Features</h2>
              <p className="text-gray-500">Everything you need to level up your career</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {([
                {
                  icon: <Zap className="w-6 h-6 text-[#FBBC05]" />,
                  title: "Instant Skill Analysis",
                  desc: "Our AI engine detects your core strengths and identifies critical skill gaps in seconds."
                },
                {
                  icon: <Target className="w-6 h-6 text-[#4285F4]" />,
                  title: "Precision Roadmap",
                  desc: "Receive a step-by-step personalized learning plan tailored to your dream career goals."
                },
                {
                  icon: <Rocket className="w-6 h-6 text-[#34A853]" />,
                  title: "Smart Role Matching",
                  desc: "Instantly see which high-impact job roles perfectly align with your current experience."
                }
              ]).map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  viewport={{ once: true }}
                  className="p-8 bg-white rounded-3xl border border-gray-100 google-shadow-hover transition-all"
                >
                  <div className="bg-gray-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-6">{item.icon}</div>
                  <h3 className="text-xl font-bold mb-3 text-gray-900">{item.title}</h3>
                  <p className="text-gray-500 leading-relaxed text-sm">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ================= HOW IT WORKS ================= */}
        <section id="how" className="py-32 bg-gray-900 text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#4285F4]/10 rounded-full blur-[100px]" />
          <div className="max-w-5xl mx-auto text-center px-6 relative z-10">
            <h2 className="text-4xl font-bold mb-16">
              Three Steps to Success
            </h2>

            <div className="grid md:grid-cols-3 gap-12">
              {([
                { icon: <Upload className="w-8 h-8" />, title: "Upload", text: "Securely upload your resume in PDF format." },
                { icon: <BarChart3 className="w-8 h-8" />, title: "Analyze", text: "AI deep-dives into your professional profile." },
                { icon: <CheckCircle className="w-8 h-8" />, title: "Succeed", text: "Follow your custom-built roadmap to success." },
              ]).map((step, i) => (
                <div key={i} className="flex flex-col items-center gap-6">
                  <div className="bg-white/10 p-5 rounded-3xl text-white backdrop-blur-md border border-white/10">
                    {step.icon}
                  </div>
                  <div>
                    <h4 className="text-xl font-bold mb-2">{step.title}</h4>
                    <p className="text-gray-400 text-sm leading-relaxed">{step.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ================= FINAL CTA ================= */}
        <section className="py-32 px-6 text-center">
          <div className="max-w-4xl mx-auto bg-gradient-to-br from-[#4285F4] to-[#34A853] p-16 rounded-[40px] text-white shadow-2xl">
            <h2 className="text-4xl md:text-5xl font-bold mb-8">
              Your next opportunity <br /> is one upload away.
            </h2>
            <p className="text-white/80 mb-12 text-lg">Join thousands of professionals already using AI to stay ahead.</p>

            <Link href="/signup">
              <button className="px-12 py-5 bg-white text-gray-900 rounded-full font-bold text-lg google-shadow hover:scale-105 transition-all">
                Get Started for Free
              </button>
            </Link>
          </div>
        </section>

        {/* ================= FOOTER ================= */}
        <footer className="py-12 border-t border-gray-100 text-center text-sm text-gray-400">
          <p>© {new Date().getFullYear()} Resume AI. All rights reserved.</p>
        </footer>
      </div>
    </Layout>
  );
}