import { useDomainService } from "@ctrl/core.ui";
import { BrowsingService } from "@ctrl/domain.service.browsing";

export const useBrowsingService = () => useDomainService(BrowsingService);
