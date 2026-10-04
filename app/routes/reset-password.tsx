import { PageContainer } from "~/components/layout/PageContainer";
import { ButtonLink } from "~/components/ui/Button";
import { Card } from "~/components/ui/Card";
import { PATHS } from "~/lib/routes";
import { buildMeta } from "~/lib/seo";

export const meta = () => buildMeta({ title: "Reset password", description: "Reset password for your THAKBO account.", noindex: true });

export default function Page() {
  return (
    <PageContainer className="max-w-md">
      <Card className="space-y-4">
        <h1 className="text-2xl font-bold">Reset password</h1>
        <p className="text-slate-700">Password reset is not enabled yet. It will be available once an e-mail service is connected.</p>
        <ButtonLink to={PATHS.login} variant="secondary">Back to log in</ButtonLink>
      </Card>
    </PageContainer>
  );
}
