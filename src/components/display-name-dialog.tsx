"use client";

import { useTranslations } from "next-intl";
import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { updateDisplayName } from "@/actions/profile";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";

interface DisplayNameDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	currentDisplayName: string | null;
	googleName: string;
}

export function DisplayNameDialog({
	open,
	onOpenChange,
	currentDisplayName,
	googleName,
}: DisplayNameDialogProps) {
	const t = useTranslations("profile");
	const tc = useTranslations("common");
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const formRef = useRef<HTMLFormElement>(null);

	function handleSubmit(formData: FormData) {
		startTransition(async () => {
			const result = await updateDisplayName(formData);
			if (result.success) {
				toast.success(t("saved"));
				onOpenChange(false);
				router.refresh();
			}
		});
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-sm">
				<DialogHeader>
					<DialogTitle>{t("displayNameLabel")}</DialogTitle>
					<DialogDescription>{t("displayNameDescription")}</DialogDescription>
				</DialogHeader>
				<form ref={formRef} action={handleSubmit}>
					<div className="flex flex-col gap-4">
						<div className="flex flex-col gap-2">
							<Label htmlFor="displayName">{t("displayNameLabel")}</Label>
							<Input
								id="displayName"
								name="displayName"
								defaultValue={currentDisplayName ?? ""}
								placeholder={t("displayNamePlaceholder")}
								maxLength={30}
								autoFocus
							/>
						</div>
						<Button type="submit" disabled={isPending}>
							{tc("save")}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
