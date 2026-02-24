import Layout from "../components/Layout";

export default function AboutPage() {
  return (
    <Layout>
      <section className="max-w-3xl mx-auto py-24 px-6 bg-white rounded-2xl shadow-lg border border-gray-200 text-center">
        <h2 className="text-3xl font-bold mb-6 text-gray-900">About Resume Screener AI</h2>
        <p className="text-lg text-gray-700 mb-4">
          Our mission is to empower job seekers and professionals with AI-driven insights for career growth.
        </p>
        <p className="text-gray-600">
          Built with modern technology and a passion for helping people succeed.
        </p>
      </section>
    </Layout>
  );
}