import { PageContainer, PageHeader } from "~/components/layout/PageContainer";
import { buildMeta } from "~/lib/seo";

export const meta = () => buildMeta({ title: "Terms of Use", description: "The rules for using THAKBO." });

export default function Page() {
  return (
    <PageContainer>
      <PageHeader title="Terms of Use" description="The rules for using THAKBO." />
      <div className="max-w-2xl space-y-4 text-slate-700">
        <p>The final terms of use will be published before launch.</p>
      </div>
    </PageContainer>
  );
}
