import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { apiService } from '@/services/api';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import SeoHead from '@/components/seo/SeoHead';
import {
  Clock, Star, CheckCircle, Shield, XCircle, AlertCircle,
  ThumbsUp, ChevronRight, Phone, Award, HelpCircle, Wrench
} from 'lucide-react';
import toast from 'react-hot-toast';

const HOW_IT_WORKS = [
  { icon: '📅', title: 'Pick date & time', desc: 'Choose a slot that works best for your schedule.' },
  { icon: '👷', title: 'Verified Pro Assigned', desc: 'A background-checked, trained technician is assigned to your booking.' },
  { icon: '🔧', title: 'Service at Doorstep', desc: 'Technician arrives on time with original parts & tools.' },
  { icon: '💳', title: 'Pay After Satisfaction', desc: 'Inspect the work, enter OTP, and pay via UPI, cash, or card.' },
];

export default function PublicServicePage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [relatedServices, setRelatedServices] = useState([]);
  const [activeFaq, setActiveFaq] = useState(null);

  useEffect(() => {
    setLoading(true);
    apiService.getServiceBySlug(slug)
      .then(res => {
        const s = res.data.data;
        setService(s);
        // Fetch related category services for internal linking
        apiService.getServices({ category: s.category })
          .then(relRes => {
            setRelatedServices((relRes.data.data || []).filter(item => item._id !== s._id).slice(0, 4));
          })
          .catch(() => {});
      })
      .catch(() => {
        toast.error('Service page not found');
      })
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
        <Header />
        <div className="flex items-center justify-center my-auto py-24">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
        <Footer />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
        <Header />
        <div className="max-w-md mx-auto text-center py-20 px-4">
          <AlertCircle size={48} className="mx-auto text-amber-500 mb-4" />
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Service Not Found</h1>
          <p className="text-slate-600 mb-6">The requested service page does not exist or has been moved.</p>
          <Link to="/" className="btn-primary inline-flex items-center gap-2">
            Explore All Services
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const defaultFaqs = [
    {
      question: `How long does ${service.name} take?`,
      answer: `The average duration for ${service.name} is approximately ${service.duration || 60} minutes. Complex issues or extra spare part replacements may take slightly longer.`
    },
    {
      question: `Is there a warranty on ${service.name}?`,
      answer: `Yes! All ${service.name} bookings on OneWayFix come with a 30-day service warranty and guaranteed satisfaction.`
    },
    {
      question: `How much does ${service.name} cost?`,
      answer: `The base price starts at ₹${service.basePrice}. Final pricing depends on any additional spare parts or extra work required, which is always confirmed with you beforehand.`
    },
    {
      question: `Are your service technicians background checked?`,
      answer: `Absolutely. Every technician on OneWayFix undergoes Aadhaar identity verification, background screening, and skill evaluation before taking jobs.`
    }
  ];

  const faqs = service.faqs?.length > 0 ? service.faqs : defaultFaqs;

  // JSON-LD Schema for Google Service & FAQPage
  const serviceJsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: service.name,
      serviceType: service.category,
      provider: {
        '@type': 'LocalBusiness',
        name: 'OneWayFix',
        url: 'https://onewayfix.com',
      },
      offers: {
        '@type': 'Offer',
        price: service.basePrice,
        priceCurrency: 'INR',
        availability: 'https://schema.org/InStock',
      },
      description: service.description,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map(f => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: f.answer,
        },
      })),
    },
  ];

  const breadcrumbs = [
    { name: 'Home', url: '/' },
    { name: service.category, url: `/category/${encodeURIComponent(service.category)}` },
    { name: service.name, url: `/service/${service.slug || slug}` },
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-16">
      <SeoHead
        title={`${service.name} Service & Repair — Professional Doorstep Service`}
        description={`Book verified professionals for ${service.name}. Starting at ₹${service.basePrice}. Doorstep service, 30-day warranty, background checked experts.`}
        canonical={`/service/${service.slug || slug}`}
        jsonLd={serviceJsonLd}
        breadcrumbs={breadcrumbs}
      />

      <Header />

      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="max-w-4xl mx-auto px-4 pt-4 text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
        {breadcrumbs.map((crumb, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && <span>/</span>}
            {idx === breadcrumbs.length - 1 ? (
              <span className="font-semibold text-slate-800">{crumb.name}</span>
            ) : (
              <Link to={crumb.url} className="hover:text-primary-600 transition-colors">{crumb.name}</Link>
            )}
          </React.Fragment>
        ))}
      </nav>

      {/* Hero Header Section */}
      <section className="max-w-4xl mx-auto px-4 pt-4">
        <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-xl border border-slate-800">
          <div className="absolute top-0 right-0 w-72 h-72 bg-primary-600/20 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-3 flex-1">
              <span className="inline-block bg-primary-500/20 text-primary-300 text-xs font-extrabold px-3 py-1 rounded-full uppercase tracking-wider border border-primary-500/30">
                {service.category}
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
                {service.name} Service & Repair
              </h1>
              <p className="text-slate-300 text-sm leading-relaxed max-w-xl">
                {service.description}
              </p>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 pt-2">
                <div className="flex items-center gap-1">
                  <Star size={14} className="text-amber-400 fill-amber-400" />
                  <span className="font-bold text-white">{service.rating?.toFixed(1) || '4.8'}</span>
                  <span>({service.ratingCount || '2.4k'} reviews)</span>
                </div>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <Clock size={14} className="text-primary-400" />
                  <span>{service.duration || 60} min avg duration</span>
                </div>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <Shield size={14} className="text-emerald-400" />
                  <span>30-Day Warranty</span>
                </div>
              </div>
            </div>

            {/* Sticky Card CTA / Price Box */}
            <div className="w-full md:w-64 bg-white text-slate-900 rounded-2xl p-5 shadow-2xl shrink-0 border border-slate-100 space-y-4">
              <div>
                <p className="text-xs text-slate-500 font-medium">Standard Service Fee</p>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-3xl font-extrabold text-primary-700">₹{service.basePrice}</span>
                  <span className="text-xs text-slate-400">/ visit</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Includes inspection & standard work</p>
              </div>

              <Link
                to={`/services/${service._id}`}
                className="w-full bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white font-bold py-3 px-4 rounded-xl text-center shadow-md shadow-primary-200 transition-all flex items-center justify-center gap-2"
              >
                Book Now <ChevronRight size={18} />
              </Link>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>⚡ Instant dispatch</span>
                <span>🔒 Pay after service</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Details */}
      <div className="max-w-4xl mx-auto px-4 mt-8 space-y-8">

        {/* What's Included / Excluded */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
            <h2 className="font-bold text-slate-900 text-lg flex items-center gap-2">
              <CheckCircle size={20} className="text-emerald-500" /> What's Included
            </h2>
            <ul className="space-y-3">
              {(service.includes?.length > 0 ? service.includes : [
                'Complete diagnostic checkup',
                'Labor & service charges included',
                'Original spare parts testing',
                'Post-service cleanup & trial'
              ]).map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
                  <CheckCircle size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
            <h2 className="font-bold text-slate-900 text-lg flex items-center gap-2">
              <XCircle size={20} className="text-red-400" /> What's NOT Included
            </h2>
            <ul className="space-y-3">
              {(service.excludes?.length > 0 ? service.excludes : [
                'Cost of new major spare parts (quoted separately if needed)',
                'Masonry or civil wall work beyond standard installation',
                'Commercial building permission fees'
              ]).map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                  <XCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* How It Works */}
        <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm">
          <h2 className="font-extrabold text-slate-900 text-xl mb-6 flex items-center gap-2">
            <Wrench size={22} className="text-primary-600" /> How Booking Works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {HOW_IT_WORKS.map((step, idx) => (
              <div key={idx} className="space-y-2 relative">
                <div className="w-12 h-12 bg-primary-50 rounded-2xl flex items-center justify-center text-2xl mb-3 shadow-inner">
                  {step.icon}
                </div>
                <span className="text-xs font-extrabold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-md">
                  Step {idx + 1}
                </span>
                <h3 className="font-bold text-slate-800 text-sm mt-1">{step.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQs */}
        <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm">
          <h2 className="font-extrabold text-slate-900 text-xl mb-6 flex items-center gap-2">
            <HelpCircle size={22} className="text-primary-600" /> Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {faqs.map((faq, idx) => {
              const isOpen = activeFaq === idx;
              return (
                <div
                  key={idx}
                  className="border border-slate-200 rounded-2xl overflow-hidden transition-all"
                >
                  <button
                    onClick={() => setActiveFaq(isOpen ? null : idx)}
                    className="w-full text-left p-4 font-bold text-slate-800 text-sm flex justify-between items-center bg-slate-50/50 hover:bg-slate-50 transition-colors"
                  >
                    <span>{faq.question}</span>
                    <span className="text-lg text-slate-400 font-mono leading-none ml-2">
                      {isOpen ? '−' : '+'}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="p-4 pt-2 text-xs sm:text-sm text-slate-600 bg-white border-t border-slate-100 leading-relaxed">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Related Services (Internal Linking) */}
        {relatedServices.length > 0 && (
          <section className="space-y-4">
            <h2 className="font-extrabold text-slate-900 text-xl">
              Related {service.category} Services
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {relatedServices.map(rel => (
                <Link
                  key={rel._id}
                  to={`/service/${rel.slug || rel._id}`}
                  className="bg-white p-4 rounded-2xl border border-slate-100 hover:shadow-lg transition-all group block"
                >
                  <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center text-xl mb-3 group-hover:scale-110 transition-transform">
                    {rel.icon || '🔧'}
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm line-clamp-1 group-hover:text-primary-600 transition-colors">
                    {rel.name}
                  </h3>
                  <p className="text-xs text-primary-700 font-extrabold mt-1">Starting at ₹{rel.basePrice}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Final CTA Banner */}
        <section className="bg-gradient-to-r from-primary-700 to-indigo-800 text-white rounded-3xl p-8 text-center space-y-4 shadow-xl">
          <h2 className="text-2xl font-extrabold">Need {service.name} Today?</h2>
          <p className="text-primary-100 text-sm max-w-lg mx-auto">
            Book verified technicians in your area with upfront pricing and zero hidden fees.
          </p>
          <Link
            to={`/services/${service._id}`}
            className="inline-flex items-center gap-2 bg-white text-primary-800 font-bold px-8 py-3.5 rounded-2xl shadow-lg hover:bg-primary-50 transition-all text-base"
          >
            Book Service Now <ChevronRight size={18} />
          </Link>
        </section>
      </div>

      <Footer />
    </div>
  );
}
