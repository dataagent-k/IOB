import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { EyeIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import InvestorModal from './InvestorModal'; // Corrected import path

// UPDATED: This type now matches the data coming from your Python backend
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
  // Add any other fields from your CSV that you want to use
  [key: string]: any; 
}

const statusOptions = [
  'To Research',
  'Ready to Pitch',
  'Pitched',
  'Follow-up',
  'Passed',
  'Invested'
];

const getLikelihoodColor = (score: number) => {
  if (score > 70) return 'bg-green-500 text-black';
  if (score >= 40) return 'bg-yellow-500 text-black';
  return 'bg-red-500 text-white';
};

const InvestorDashboard = () => {
  // REMOVED: mockInvestors is gone. We now fetch live data.
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvestor, setSelectedInvestor] = useState<Investor | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const API_URL = 'http://localhost:5000';

  // ADDED: Fetch data from the backend when the component loads
  useEffect(() => {
    const fetchInvestors = async () => {
        try {
            const response = await fetch(`${API_URL}/api/investors`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            setInvestors(data);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    };
    fetchInvestors();
  }, []);

  // UPDATED: This function now sends the status change to the backend
  const handleStatusChange = async (investorId: number, newStatus: string) => {
    // Optimistic UI update for a smooth experience
    setInvestors(prev => 
      prev.map(investor => 
        investor.id === investorId 
          ? { ...investor, status: newStatus }
          : investor
      )
    );
    // Send the update to the backend
    try {
        await fetch(`${API_URL}/api/update_status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: investorId, status: newStatus }),
        });
    } catch (error) {
        console.error('Failed to update status on server:', error);
        // Optionally, you could add logic here to revert the UI change if the server call fails
    }
  };

  const handleRowClick = (investor: Investor) => {
    setSelectedInvestor(investor);
    setIsModalOpen(true);
  };

  const filteredInvestors = investors.filter(investor =>
    investor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    investor.fund.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (investor.twitter_handle && investor.twitter_handle.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedInvestor(null);
  };

  if (isLoading) return <p className="text-white p-6">Loading investor data from backend...</p>;
  if (error) return <p className="text-red-500 p-6">Error fetching data: {error}</p>;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-6">
            Investor Outreach Dashboard
          </h1>
          <div className="flex gap-4 mb-6">
            <Input
              placeholder="Search investors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md bg-card border-border text-foreground placeholder:text-muted-foreground"
            />
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                + Add New Investor
            </Button>
          </div>
        </div>

        {/* Table */}
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
                        <img
                          src={investor.avatar_url || `https://i.pravatar.cc/40?u=${investor.id}`}
                          alt={investor.name}
                          className="w-10 h-10 rounded-full object-cover"
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
                            <SelectItem 
                              key={status} 
                              value={status}
                              className="text-popover-foreground hover:bg-accent hover:text-accent-foreground"
                            >
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowClick(investor);
                          }}
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

      {/* Modal */}
      <InvestorModal
        isOpen={isModalOpen}
        onClose={closeModal}
        investor={selectedInvestor}
      />
    </div>
  );
};

export default InvestorDashboard;