import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EyeIcon } from '@heroicons/react/24/outline';
import InvestorModal from './InvestorModal';
import { AddInvestorModal } from './AddInvestorModal'; // NEW: Import the new modal

export interface Investor {
  id: number;
  name: string;
  twitter_handle: string;
  avatar_url: string;
  fund: string;
  likelihood_score: number;
  stage_focus: string;
  status: string;
  linkedin_url: string;
  domain: string;
  notes_for_pitch: string;
  bio: string;
  thesis: string;
  [key: string]: any; 
}

const statusOptions = ['To Research', 'Ready to Pitch', 'Pitched', 'Follow-up', 'Passed', 'Invested'];

const getLikelihoodColor = (score: number) => {
  if (score > 70) return 'bg-green-500 text-black';
  if (score >= 40) return 'bg-yellow-500 text-black';
  return 'bg-red-500 text-white';
};

const InvestorDashboard = () => {
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvestor, setSelectedInvestor] = useState<Investor | null>(null);
  const [isPitchModalOpen, setIsPitchModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false); // NEW: State for the add modal
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const API_URL = 'http://localhost:5000';

  const fetchInvestors = useCallback(async () => {
    setIsLoading(true);
    try {
        const response = await fetch(`${API_URL}/api/investors`);
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || `HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setInvestors(data);
    } catch (e: any) {
        setError(e.message);
    } finally {
        setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvestors();
  }, [fetchInvestors]);

  const handleStatusChange = async (investorId: number, newStatus: string) => {
    setInvestors(prev => prev.map(inv => inv.id === investorId ? { ...inv, status: newStatus } : inv));
    try {
        await fetch(`${API_URL}/api/update_status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: investorId, status: newStatus }),
        });
    } catch (error) {
        console.error('Failed to update status on server:', error);
    }
  };

  const handleRowClick = (investor: Investor) => {
    setSelectedInvestor(investor);
    setIsPitchModalOpen(true);
  };

  const filteredInvestors = investors.filter(investor =>
    investor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    investor.fund.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (investor.twitter_handle && investor.twitter_handle.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (isLoading) return <p className="text-white p-6 text-center">Loading investor data from backend...</p>;
  if (error) return <p className="text-red-500 p-6 text-center">Error fetching data: {error}</p>;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-6">Investor Outreach Dashboard</h1>
          <div className="flex gap-4 mb-6">
            <Input
              placeholder="Search investors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md bg-card border-border text-foreground placeholder:text-muted-foreground"
            />
            {/* NEW: This button now opens the AddInvestorModal */}
            <Button onClick={() => setIsAddModalOpen(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
                + Add New Investor
            </Button>
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left p-4 font-semibold text-foreground">Investor</th>
                  <th className="text-left p-4 font-semibold text-foreground">Fund</th>
                  <th className="text-left p-4 font-semibold text-foreground">Likelihood Score</th>
                  <th className="text-left p-4 font-semibold text-foreground">Stage Focus</th>
                  <th className="text-left p-4 font-semibold text-foreground">Status</th>
                  <th className="text-left p-4 font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvestors.map((investor) => (
                  <tr
                    key={investor.id}
                    onClick={() => handleRowClick(investor)}
                    className="border-b border-border hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {/* FIX: Use avatar_url and add a fallback */}
                        <img
                          src={investor.avatar_url || `https://i.pravatar.cc/40?u=${investor.id}`}
                          alt={investor.name}
                          className="w-10 h-10 rounded-full object-cover bg-muted"
                        />
                        <div>
                          <div className="font-medium text-foreground">{investor.name}</div>
                          <div className="text-sm text-muted-foreground">{investor.twitter_handle}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-foreground">{investor.fund}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${getLikelihoodColor(investor.likelihood_score)}`}>
                        {investor.likelihood_score}
                      </span>
                    </td>
                    <td className="p-4 text-foreground">{investor.stage_focus}</td>
                    <td className="p-4">
                      <Select
                        value={investor.status}
                        onValueChange={(value) => handleStatusChange(investor.id, value)}
                      >
                        <SelectTrigger 
                          className="w-40 bg-background border-border text-foreground"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border">
                          {statusOptions.map((status) => (
                            <SelectItem key={status} value={status} className="text-popover-foreground hover:bg-accent hover:text-accent-foreground">
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-4">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRowClick(investor); }}
                          className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                          title="View/Pitch"
                        >
                          <EyeIcon className="w-5 h-5" />
                        </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isPitchModalOpen && selectedInvestor && (
        <InvestorModal
          isOpen={isPitchModalOpen}
          onClose={() => setIsPitchModalOpen(false)}
          investor={selectedInvestor}
        />
      )}
      
      {/* NEW: Render the AddInvestorModal */}
      <AddInvestorModal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onInvestorsAdded={fetchInvestors}
      />
    </div>
  );
};

export default InvestorDashboard;