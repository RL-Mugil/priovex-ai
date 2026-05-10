import { UserProfile } from '@clerk/nextjs';

export default function SettingsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Account Settings</h1>
        <p className="text-slate-500 mt-1">Manage your account and preferences</p>
      </div>
      <div className="flex justify-center">
        <UserProfile 
          routing="hash"
          appearance={{
            elements: {
              rootBox: 'w-full shadow-none',
              card: 'shadow-none border border-slate-200 w-full',
            }
          }} 
        />
      </div>
    </div>
  );
}
