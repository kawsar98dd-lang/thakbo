import { PageContainer, PageHeader } from "~/components/layout/PageContainer";
import { buildMeta } from "~/lib/seo";

export const meta = () => buildMeta({ title: "THAKBO (থাকবো) | কীভাবে কাজ করে — বাসা, রুম ও মেস ভাড়া", description: "THAKBO-তে শহর ও এলাকা বেছে বাসা ভাড়া, রুম ভাড়া বা মেস খুঁজুন, লিস্টিংয়ের তথ্য তুলনা করুন এবং মালিকের সঙ্গে যোগাযোগ করুন। Find and compare accommodation in Bangladesh with THAKBO." });

export default function Page() {
  return (
    <PageContainer>
      <PageHeader title="How it works" description="Find, compare and contact in a few simple steps." />
      <div className="max-w-2xl space-y-4 text-slate-700">
        <ol className="list-decimal space-y-2 pl-5">
          <li>Tell us where you want to live.</li>
          <li>Filter by price, property type and who it is for.</li>
          <li>Open a listing, save it and contact the owner.</li>
          <li>Own a place? Log in and list it in a few minutes.</li>
        </ol>
        <section aria-labelledby="steps-bn-heading" className="border-t border-slate-200 pt-4">
          <h2 id="steps-bn-heading" className="text-lg font-bold text-slate-900">THAKBO ব্যবহার করার নিয়ম</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5" lang="bn">
            <li>আপনার পছন্দের শহর ও এলাকা নির্বাচন করুন।</li>
            <li>বাসা, ফ্ল্যাট, রুম, সাবলেট বা মেসের লিস্টিং দেখুন এবং ভাড়া ও সুবিধা তুলনা করুন।</li>
            <li>লিস্টিংয়ের বিস্তারিত তথ্য পড়ে মালিকের সঙ্গে যোগাযোগ করুন। জায়গা ও মালিক যাচাই না করে অগ্রিম টাকা পাঠাবেন না।</li>
            <li>আপনি মালিক বা হোস্ট হলে অ্যাকাউন্ট খুলে সঠিক তথ্যসহ লিস্টিং জমা দিন। পর্যালোচনার পর অনুমোদিত লিস্টিং প্রকাশ করা হবে।</li>
          </ol>
        </section>
      </div>
    </PageContainer>
  );
}
