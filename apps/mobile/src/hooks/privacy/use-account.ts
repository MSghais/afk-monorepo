import { Account } from "../../interfaces";
import { AccountService } from "../../services/privacy/account.service";
import { useEffect, useState } from "react";

export const useAccount = () => {
  const [account, setAccount] = useState<Account | null>(null);

  useEffect(() => {
    AccountService.getAccount().then((account) => {
      setAccount(account);
    });
  }, []);

  return { account };
};
