import LegalDocumentPage from '../components/LegalDocumentPage';
import {
  TERMS_OF_USE_SECTIONS,
  TERMS_OF_USE_SUMMARY,
  TERMS_OF_USE_TITLE,
} from '../content/legalTerms';

export default function TermsPage() {
  return (
    <LegalDocumentPage
      title={TERMS_OF_USE_TITLE}
      summary={TERMS_OF_USE_SUMMARY}
      sections={TERMS_OF_USE_SECTIONS}
      icon="terms"
    />
  );
}
