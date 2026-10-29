import { ReceiptWalletProvider } from '../../components/wallet/ReceiptWalletProvider';
import { TaxInvoiceIssueWorkspace } from '../../components/taxinvoice/TaxInvoiceIssueWorkspace';

export function AdminTaxInvoiceIssuePage() {
  return (
    <ReceiptWalletProvider>
      <TaxInvoiceIssueWorkspace />
    </ReceiptWalletProvider>
  );
}
