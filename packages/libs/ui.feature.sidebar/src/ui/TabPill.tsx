import { tabGroupPills } from "./tabGroupPills.style";

export type TabPillProps = {
	id: string;
	label: string;
	faviconUrl?: string;
	active: boolean;
	onClick: (id: string) => void;
	onClose?: (id: string) => void;
};

export function TabPill(props: TabPillProps) {
	const $ = () => tabGroupPills({ active: props.active });

	return (
		<button
			type="button"
			class={$().pill}
			onClick={() => props.onClick(props.id)}
			title={props.label}
		>
			{props.faviconUrl && (
				<img
					src={props.faviconUrl}
					alt=""
					class={$().favicon}
					onError={(e) => {
						(e.currentTarget as HTMLImageElement).style.display = "none";
					}}
				/>
			)}
			<span class={$().title}>{props.label}</span>
		</button>
	);
}
