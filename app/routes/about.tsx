import { PageContainer, PageHeader } from "~/components/layout/PageContainer";
import { buildMeta } from "~/lib/seo";

export const meta = () => buildMeta({ title: "THAKBO (থাকবো) | আমাদের সম্পর্কে — বাসা, রুম ও মেস খুঁজুন", description: "THAKBO (থাকবো) বাংলাদেশের ব্যবহারকারীদের শহর ও এলাকার ভিত্তিতে বাসা ভাড়া, রুম ভাড়া, ফ্ল্যাট, সাবলেট ও মেস খুঁজতে সাহায্য করে। Learn about THAKBO, a location-first accommodation discovery platform for Bangladesh." });

export default function Page() {
  return (
    <PageContainer>
      <PageHeader title="About THAKBO" description="THAKBO is a location-first accommodation marketplace for Bangladesh." />
      <div className="max-w-2xl space-y-4 text-slate-700">
        <p>THAKBO helps people find mess, rooms, flats, houses and sublets close to the place they want to be. Owners can list their own places with one simple account.</p>
        <p>We are starting in Rajshahi and building for every city in Bangladesh.</p>
        <p lang="bn">থাকবোতে প্রকাশিত লিস্টিং দেখে নিজের প্রয়োজন, পছন্দের এলাকা এবং মাসিক ভাড়ার সঙ্গে মিলিয়ে থাকার জায়গা খুঁজে নিতে পারেন। বাড়ি বা রুম ভাড়া দিতে চাইলে অ্যাকাউন্ট খুলে আপনার লিস্টিং জমা দিন; প্রকাশের আগে লিস্টিং পর্যালোচনা করা হয়।</p>
      </div>
    </PageContainer>
  );
}
