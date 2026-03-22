import { For } from "solid-js";
import { TabPill, type TabPillProps } from "./TabPill";
import { tabGroupPills } from "./tabGroupPills.style";

export type TabGroupPillsProps = {
	tabs: Omit<TabPillProps, "onClick" | "onClose">[];
	onTabClick: (id: string) => void;
	onTabClose?: (id: string) => void;
};

export function TabGroupPills(props: TabGroupPillsProps) {
	const $ = tabGroupPills();

	return (
		<div class={$.container}>
			<For each={props.tabs}>
				{(tab) => (
					<TabPill
						id={tab.id}
						label={tab.label}
						faviconUrl={tab.faviconUrl}
						active={tab.active}
						onClick={props.onTabClick}
						onClose={props.onTabClose}
					/>
				)}
			</For>
		</div>
	);
}
