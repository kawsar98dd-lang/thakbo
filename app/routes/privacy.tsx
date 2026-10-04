import { PageContainer, PageHeader } from "~/components/layout/PageContainer";
import { buildMeta } from "~/lib/seo";

export const meta = () => buildMeta({ title: "Privacy Policy", description: "How THAKBO handles your information." });

export default function Page() {
  return (
    <PageContainer>
      <PageHeader title="Privacy Policy" description="How THAKBO handles your information." />
      <div className="max-w-2xl space-y-4 text-slate-700">
        <p>The final privacy policy will be published before launch. It will be reviewed for Bangladesh requirements.</p>
      </div>
    </PageContainer>
  );
}
