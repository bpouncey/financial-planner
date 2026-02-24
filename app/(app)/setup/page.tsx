import { HouseholdSetupForm } from "./_components/HouseholdSetupForm";
import { AccountsForm } from "./_components/accounts-form";
import { OutOfPocketForm, MonthlySavingsForm } from "./_components/contributions-form";
import { EmergencyFundGoalForm } from "./_components/emergency-fund-goal-form";
import { EquityGrantsForm } from "./_components/equity-grants-form";
import { EventsForm } from "./_components/events-form";
import { ImportExportSection } from "./_components/ImportExportSection";
import { ValidationBanner } from "@/app/(app)/setup/_components/validation-banner";

export default function SetupPage() {
  return (
    <div className="p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-content">
            Household Setup
          </h1>
          <p className="mt-2 text-content-muted">
            Configure your household, people, and accounts.
          </p>
        </div>
        <ImportExportSection />
      </div>
      <ValidationBanner />
      <div className="mt-8">
        <HouseholdSetupForm />
      </div>
      <AccountsForm />
      <OutOfPocketForm />
      <MonthlySavingsForm />
      <EmergencyFundGoalForm />
      <EventsForm />
      <EquityGrantsForm />
    </div>
  );
}
