"use client";

import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { cn } from "@repo/ui/lib/utils";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { type ComponentProps, useState } from "react";

type PasswordInputProps = Omit<
	ComponentProps<typeof Input>,
	"type" | "value" | "onChange"
> & {
	value: string;
	onChange: (value: string) => void;
};

function PasswordInput({
	value,
	onChange,
	className,
	...inputProps
}: PasswordInputProps) {
	const [isPasswordVisible, setIsPasswordVisible] = useState(false);

	return (
		<div className={cn("relative", className)}>
			<Input
				{...inputProps}
				type={isPasswordVisible ? "text" : "password"}
				className="pr-10"
				value={value}
				onChange={(event) => onChange(event.target.value)}
			/>
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground"
				onClick={() => setIsPasswordVisible((isVisible) => !isVisible)}
				aria-label={
					isPasswordVisible ? "Hide password" : "Show password"
				}
				aria-pressed={isPasswordVisible}
			>
				{isPasswordVisible ? <EyeOffIcon /> : <EyeIcon />}
			</Button>
		</div>
	);
}

export { PasswordInput };
