import React from 'react';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import SeoHead from '@/components/seo/SeoHead';
import { FileText, Shield, CheckCircle, AlertCircle, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TermsOfService() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      <SeoHead
        title="Terms of Service | OneWayFix"
        description="Read the Terms of Service for using OneWayFix home service booking platform."
        canonical="/terms"
      />
      <Header />
      <main className="py-6 pb-16 px-4 max-w-4xl mx-auto">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-500 hover:text-primary-600 mb-8 transition-colors"
        >
          <ChevronLeft size={20} /> Back
        </button>

        <div className="space-y-12">
          <header className="text-center">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <FileText size={32} />
            </div>
            <h1 className="text-4xl font-extrabold text-slate-900 mb-4">Terms of Service</h1>
            <p className="text-slate-500">Last updated: May 29, 2026</p>
          </header>

          <section className="prose prose-slate max-w-none">
            <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100 mb-12">
              <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Shield className="text-primary-500" size={20} /> User Agreement
              </h2>
              <p className="text-slate-600 leading-relaxed">
                By accessing or using ServiceHub, you agree to be bound by these Terms of Service. Please read them carefully before booking any home services through our platform.
              </p>
            </div>

            <div className="space-y-8">
              {[
                {
                  icon: CheckCircle,
                  title: '1. Service Bookings & Confirmation',
                  content: 'Service requests placed on ServiceHub match you with verified independent professionals. A booking is confirmed once accepted by an available provider. Cancellation policies and timelines apply.'
                },
                {
                  icon: Shield,
                  title: '2. Customer Responsibilities',
                  content: 'Customers must provide accurate address details, ensure safe access to the premises for service delivery, and verify job completion using the 4-digit PIN provided in the app.'
                },
                {
                  icon: AlertCircle,
                  title: '3. Pricing & Payments',
                  content: 'All service prices, material costs, and payment breakdowns are transparently shown. Payments are processed securely upon successful completion of the service.'
                },
                {
                  icon: FileText,
                  title: '4. Complaints & Dispute Window',
                  content: 'Customers have a 30-day window following service completion to raise complaints or request warranty resolution. Providers are required to resolve complaints promptly.'
                }
              ].map((item, i) => (
                <div key={i} className="group">
                  <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-primary-600 group-hover:bg-primary-600 group-hover:text-white transition-all">
                      <item.icon size={18} />
                    </span>
                    {item.title}
                  </h3>
                  <p className="text-slate-600 pl-11 leading-relaxed">{item.content}</p>
                </div>
              ))}
            </div>

            <div className="mt-16 p-8 rounded-3xl bg-slate-900 text-white text-center">
              <h3 className="text-xl font-bold mb-3">Have questions regarding Terms?</h3>
              <p className="text-slate-300 mb-6 text-sm">Reach out to our support team for clarification on any terms.</p>
              <a href="mailto:support@servicehub.com" className="bg-white text-slate-900 px-8 py-3 rounded-xl font-bold hover:bg-slate-100 transition-colors">
                Contact Legal Team
              </a>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
