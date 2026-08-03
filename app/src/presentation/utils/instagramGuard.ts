import type { SocialAccount } from "../../domain/models";

// Publishing goes through the Instagram Graph API, so every content-creation flow
// that ends in a scheduled post needs a connected professional account first.
export const INSTAGRAM_REQUIRED_MESSAGE =
  "Conecte uma conta profissional do Instagram antes de criar publicações. Abra Contas sociais para conectar.";

export const connectedInstagramAccount = (
  accounts: SocialAccount[],
): SocialAccount | undefined =>
  accounts.find(
    (account) => account.network === "instagram" && account.connected,
  );
