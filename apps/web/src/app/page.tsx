import Link from 'next/link';
import { ArrowRight, Search, Zap, Shield, BarChart3, FileText, Globe } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-blue-950 to-slate-950 text-white">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-slate-950/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <Search className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold">PrioVex.AI</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-slate-400">
            <Link href="#features" className="hover:text-white transition-colors">Features</Link>
            <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
            <Link href="/sign-in" className="hover:text-white transition-colors">Sign In</Link>
          </div>
          <Link
            href="/sign-up"
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Start Free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-40 pb-32 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 text-sm text-blue-300 mb-8">
            <Zap className="w-3.5 h-3.5" />
            Powered by Claude, GPT-4o & Gemini
          </div>
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            Patent Prior Art Search
            <br />
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Powered by AI
            </span>
          </h1>
          <p className="text-xl text-slate-400 mb-12 max-w-3xl mx-auto leading-relaxed">
            Search 100M+ patents via BigQuery. Get professional patentability assessments,
            CPC analysis, and USPTO-ready reports in under 45 minutes — not weeks.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/sign-up"
              className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all hover:scale-105 flex items-center gap-2 justify-center"
            >
              Start Free Search <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="#features"
              className="border border-white/20 hover:border-white/40 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all hover:bg-white/5 flex items-center gap-2 justify-center"
            >
              See How It Works
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 border-y border-white/10">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: '100M+', label: 'Patents Indexed' },
            { value: '45 min', label: 'Avg Search Time' },
            { value: '3 AI', label: 'Provider Options' },
            { value: '195+', label: 'Countries Covered' },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-4xl font-bold text-blue-400 mb-1">{stat.value}</div>
              <div className="text-sm text-slate-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Enterprise-Grade Search Pipeline</h2>
            <p className="text-slate-400 text-lg">7-step methodology used by top patent firms</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Search, title: 'BigQuery Patent Search', desc: 'Search 100M+ patents using Google Patents Public Data with optimized SQL queries and CPC classification search.' },
              { icon: Zap, title: 'Multi-Provider AI Analysis', desc: 'Choose Claude, GPT-4o, or Gemini for patentability analysis. Automatic fallback if a provider is unavailable.' },
              { icon: BarChart3, title: 'Timeline & Competitor Analysis', desc: 'Understand the technology landscape — filing trends, key assignees, and emerging competitors.' },
              { icon: FileText, title: 'Professional Reports', desc: 'Export PDF, Markdown, and JSON reports suitable for attorneys, investors, and patent examiners.' },
              { icon: Shield, title: 'IDS References', desc: 'Automatically generates Information Disclosure Statement references required for USPTO filing.' },
              { icon: Globe, title: 'Multi-Jurisdiction', desc: 'Search across US, EP, WO, CN, JP, KR and more. Full international patent coverage.' },
            ].map((feature) => (
              <div
                key={feature.title}
                className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/8 transition-colors"
              >
                <feature.icon className="w-8 h-8 text-blue-400 mb-4" />
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/30 rounded-3xl p-12">
          <h2 className="text-4xl font-bold mb-4">Ready to Search?</h2>
          <p className="text-slate-400 mb-8 text-lg">
            Start with 1 free search. No credit card required.
          </p>
          <Link
            href="/sign-up"
            className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-xl font-semibold text-lg inline-flex items-center gap-2 transition-all hover:scale-105"
          >
            Get Started Free <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center">
              <Search className="w-3 h-3 text-white" />
            </div>
            <span className="font-semibold">PrioVex.AI</span>
          </div>
          <p className="text-slate-500 text-sm">
            © {new Date().getFullYear()} PrioVex.AI. For informational purposes only. Not legal advice.
          </p>
        </div>
      </footer>
    </div>
  );
}
