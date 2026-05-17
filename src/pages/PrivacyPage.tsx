import LegalDocumentPage from '../components/LegalDocumentPage';
import {
  PRIVACY_POLICY_SECTIONS,
  PRIVACY_POLICY_SUMMARY,
  PRIVACY_POLICY_TITLE,
} from '../content/legalTerms';

export default function PrivacyPage() {
  return (
    <LegalDocumentPage
      title={PRIVACY_POLICY_TITLE}
      summary={PRIVACY_POLICY_SUMMARY}
      sections={PRIVACY_POLICY_SECTIONS}
      icon="privacy"
    />
  );
}
