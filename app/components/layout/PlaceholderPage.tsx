import { PATHS } from "~/lib/routes";
import { ButtonLink } from "~/components/ui/Button";
import { EmptyState } from "~/components/ui/EmptyState";
import type { IconName } from "~/components/ui/Icon";
import { PageContainer, PageHeader } from "./PageContainer";

/** Honest "coming soon" page for routes whose real functionality belongs to a later milestone. */
export function PlaceholderPage({
  title,
  description,
  milestone,
  icon = "pin",
}: {
  title: string;
  description: string;
  milestone: string;
  icon?: IconName;
}) {
  return (
    <PageContainer>
      <PageHeader title={title} description={description} />
      <EmptyState
        icon={icon}
        title="This section is not built yet"
        description={`It is planned for ${milestone}. The page and its URL already exist so links never break.`}
        action={<ButtonLink to={PATHS.home} variant="secondary">Back to home</ButtonLink>}
      />
    </PageContainer>
  );
}
