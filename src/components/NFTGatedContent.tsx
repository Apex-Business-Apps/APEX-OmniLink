/**
 * NFT-Gated Content Example Component
 *
 * Purpose: Demonstration of how to use Web3 entitlement checking
 *          to gate premium content based on NFT ownership
 *
 * Usage: Import this component where you need NFT-gated features
 *
 * Author: OmniLink APEX
 * Date: 2026-01-01
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useWalletVerification } from '@/hooks/useWalletVerification';
import { checkEntitlement } from '@/lib/web3/entitlements';
import { Loader2, Lock, Unlock, AlertTriangle, Crown } from 'lucide-react';

interface NFTGateConfig {
  contractAddress: string;
  chainId: number;
  entitlementKey: string;
  title: string;
  description: string;
}

interface NFTGatedContentProps {
  config: NFTGateConfig;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Component that gates content based on NFT ownership
 */
export function NFTGatedContent({ config, children, fallback }: NFTGatedContentProps) {
  const { walletState } = useWalletVerification();
  const [hasAccess, setHasAccess] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheHit, setCacheHit] = useState(false);

  useEffect(() => {
    checkAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletState.address, walletState.isVerified]);

  const checkAccess = async () => {
    if (!walletState.isVerified || !walletState.address) {
      setHasAccess(false);
      setIsChecking(false);
      return;
    }

    setIsChecking(true);
    setError(null);

    try {
      const result = await checkEntitlement({
        walletAddress: walletState.address as `0x${string}`,
        chainId: config.chainId,
        contractAddress: config.contractAddress as `0x${string}`,
        entitlementKey: config.entitlementKey,
      });

      setHasAccess(result.hasEntitlement);
      setCacheHit(result.cacheHit || false);

      if (!result.hasEntitlement && result.error) {
        setError(result.error);
      }
    } catch (err) {
      console.error('Entitlement check error:', err);
      setError((err as Error).message);
      setHasAccess(false);
    } finally {
      setIsChecking(false);
    }
  };

  // Not connected state
  if (!walletState.isVerified) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-muted-foreground" />
            <CardTitle>{config.title}</CardTitle>
          </div>
          <CardDescription>{config.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Please connect and verify your wallet to check access to this premium content.
            </AlertDescription>
          </Alert>
          <div className="mt-4">
            <p className="text-sm text-muted-foreground">
              Navigate to the <strong>Integrations</strong> page to connect your wallet.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Checking state
  if (isChecking) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Checking NFT ownership...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Access denied state
  if (!hasAccess) {
    return (
      fallback || (
        <Card className="border-destructive/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-destructive" />
              <CardTitle>Access Denied</CardTitle>
            </div>
            <CardDescription>NFT ownership required</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {error || 'You do not own the required NFT to access this content.'}
              </AlertDescription>
            </Alert>
            <div className="space-y-2 text-sm">
              <p className="font-medium">Required NFT:</p>
              <div className="bg-muted p-3 rounded-lg space-y-1">
                <p className="font-mono text-xs break-all">
                  <strong>Contract:</strong> {config.contractAddress}
                </p>
                <p className="text-xs">
                  <strong>Chain:</strong> {config.chainId === 1 ? 'Ethereum' : `Chain ${config.chainId}`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )
    );
  }

  // Access granted state
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
        <div className="flex items-center gap-2">
          <Unlock className="h-5 w-5 text-green-600" />
          <div>
            <p className="text-sm font-medium text-green-900 dark:text-green-100">Premium Access Granted</p>
            <p className="text-xs text-green-700 dark:text-green-300">
              NFT verified • {cacheHit ? 'Cached' : 'Live check'}
            </p>
          </div>
        </div>
        <Badge variant="default" className="bg-green-600">
          <Crown className="h-3 w-3 mr-1" />
          NFT Holder
        </Badge>
      </div>
      {children}
    </div>
  );
}

/**
 * Example usage of NFT-gated content
 */
export function NFTGatedExample() {
  const nftConfig: NFTGateConfig = {
    contractAddress: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D', // Example: Bored Ape Yacht Club
    chainId: 1, // Ethereum mainnet
    entitlementKey: 'nft:bayc-premium',
    title: 'BAYC Premium Features',
    description: 'Exclusive content for Bored Ape Yacht Club holders',
  };

  return (
    <NFTGatedContent config={nftConfig}>
      <Card>
        <CardHeader>
          <CardTitle>Welcome, BAYC Holder! 🎉</CardTitle>
          <CardDescription>You have access to exclusive premium features</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg border">
            <h3 className="font-semibold mb-2">Premium Content</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-yellow-600" />
                Early access to new features
              </li>
              <li className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-yellow-600" />
                Exclusive community chat
              </li>
              <li className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-yellow-600" />
                Priority support
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </NFTGatedContent>
  );
}
