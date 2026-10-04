import { useNavigation } from "react-router";
import { Button } from "~/components/ui/Button";

/** Submit button that shows a spinner while the surrounding form is being submitted. */
export function SubmitButton({ children, pendingText = "Please wait…" }: { children: string; pendingText?: string }) {
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";
  return (
    <Button type="submit" size="lg" className="w-full" loading={submitting}>
      {submitting ? pendingText : children}
    </Button>
  );
}
