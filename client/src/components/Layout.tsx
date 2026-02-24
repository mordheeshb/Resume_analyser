import Link from "next/link";
import { Brain } from "lucide-react";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans antialiased relative">
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#4285F4]/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#34A853]/5 rounded-full blur-[140px]" />
      </div>

      <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-gray-100">
        <nav className="max-w-7xl mx-auto px-6 h-16 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="bg-gradient-to-br from-[#4285F4] to-[#34A853] p-1.5 rounded-lg shadow-sm group-hover:shadow-md transition-all">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-semibold tracking-tight text-gray-900">
              Resume <span className="text-[#4285F4]">AI</span>
            </span>
          </Link>

          <div className="hidden md:flex gap-8 text-sm font-medium text-gray-600">
            <Link href="/#features" className="hover:text-[#4285F4] transition">Features</Link>
            <Link href="/#how" className="hover:text-[#4285F4] transition">How it works</Link>
            <Link href="/about" className="hover:text-[#4285F4] transition">About</Link>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/login">
              <button className="btn-google btn-outline text-sm py-1.5 px-4 rounded-md">
                Sign in
              </button>
            </Link>
            <Link href="/signup">
              <button className="btn-google btn-primary text-sm py-1.5 px-4 rounded-md">
                Get started
              </button>
            </Link>
          </div>
        </nav>
      </header>

      <main className="relative z-10">{children}</main>
    </div>
  );
}
