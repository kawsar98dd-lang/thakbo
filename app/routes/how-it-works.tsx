import { PageContainer, PageHeader } from "~/components/layout/PageContainer";
import { buildMeta } from "~/lib/seo";

export const meta = () => buildMeta({ title: "How it works", description: "Find, compare and contact in a few simple steps." });

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
      </div>
    </PageContainer>
  );
}
