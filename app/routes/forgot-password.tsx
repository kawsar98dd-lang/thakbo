import { PageContainer } from "~/components/layout/PageContainer";
import { ButtonLink } from "~/components/ui/Button";
import { Card } from "~/components/ui/Card";
import { PATHS } from "~/lib/routes";
import { buildMeta } from "~/lib/seo";

export const meta = () => buildMeta({ title: "Forgot password", description: "Forgot password for your THAKBO account.", noindex: true });

export default function Page() {
  return (
    <PageContainer className="max-w-md">
      <Card className="space-y-4">
        <h1 className="text-2xl font-bold">Forgot password</h1>
        <p className="text-slate-700">Password reset needs an e-mail service, which is not connected yet. It will be enabled in a later milestone.</p>
        <ButtonLink to={PATHS.login} variant="secondary">Back to log in</ButtonLink>
      </Card>
    </PageContainer>
  );
}
