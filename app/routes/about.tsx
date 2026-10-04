import { PageContainer, PageHeader } from "~/components/layout/PageContainer";
import { buildMeta } from "~/lib/seo";

export const meta = () => buildMeta({ title: "About THAKBO", description: "THAKBO is a location-first accommodation marketplace for Bangladesh." });

export default function Page() {
  return (
    <PageContainer>
      <PageHeader title="About THAKBO" description="THAKBO is a location-first accommodation marketplace for Bangladesh." />
      <div className="max-w-2xl space-y-4 text-slate-700">
        <p>THAKBO helps people find mess, rooms, flats, houses and sublets close to the place they want to be. Owners can list their own places with one simple account.</p>
        <p>We are starting in Rajshahi and building for every city in Bangladesh.</p>
      </div>
    </PageContainer>
  );
}
