import { PageContainer, PageHeader } from "~/components/layout/PageContainer";
import { buildMeta } from "~/lib/seo";

export const meta = () => buildMeta({ title: "Contact", description: "Get in touch with the THAKBO team." });

export default function Page() {
  return (
    <PageContainer>
      <PageHeader title="Contact" description="Get in touch with the THAKBO team." />
      <div className="max-w-2xl space-y-4 text-slate-700">
        <p>The contact form and support details will be added before launch. Please check back soon.</p>
      </div>
    </PageContainer>
  );
}
