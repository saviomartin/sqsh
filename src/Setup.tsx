import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import { Spinner } from '@inkjs/ui';
import { execSync, spawn } from 'child_process';
import { checkFFmpegInstalled } from './utils.js';

// Setup step type
type SetupStep =
  | 'checking'
  | 'already-installed'
  | 'not-installed'
  | 'select-method'
  | 'installing'
  | 'install-success'
  | 'install-error'
  | 'manual-instructions';

// Installation method type
interface InstallMethod {
  id: string;
  name: string;
  command: string;
  description: string;
  available: boolean;
}

// Props for Setup component
interface SetupProps {
  forceSetup?: boolean;
  onComplete?: () => void; // Called when setup is done and user wants to proceed
}

// Check if Homebrew is available
function checkBrewAvailable(): boolean {
  try {
    execSync('which brew', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// Get FFmpeg version if installed
function getFFmpegVersion(): string | null {
  try {
    const output = execSync('ffmpeg -version', { stdio: 'pipe' }).toString();
    const match = output.match(/ffmpeg version ([^\s]+)/);
    return match ? match[1] : 'installed';
  } catch {
    return null;
  }
}

// Get available installation methods based on platform
function getInstallMethods(): InstallMethod[] {
  const methods: InstallMethod[] = [];
  const platform = process.platform;

  if (platform === 'darwin') {
    methods.push({
      id: 'brew',
      name: 'Homebrew',
      command: 'brew install ffmpeg',
      description: 'Fast and reliable package manager',
      available: checkBrewAvailable(),
    });
  }

  if (platform === 'linux') {
    methods.push({
      id: 'apt',
      name: 'APT',
      command: 'sudo apt-get install -y ffmpeg',
      description: 'For Debian/Ubuntu systems',
      available: true,
    });
    methods.push({
      id: 'yum',
      name: 'YUM',
      command: 'sudo yum install -y ffmpeg',
      description: 'For CentOS/RHEL systems',
      available: true,
    });
  }

  methods.push({
    id: 'manual',
    name: 'Manual',
    command: '',
    description: 'Show download instructions',
    available: true,
  });

  return methods;
}

export const Setup: React.FC<SetupProps> = ({ forceSetup = false, onComplete }) => {
  const [step, setStep] = useState<SetupStep>('checking');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [installMethods, setInstallMethods] = useState<InstallMethod[]>([]);
  const [installOutput, setInstallOutput] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [ffmpegVersion, setFfmpegVersion] = useState<string | null>(null);
  const installProcessRef = useRef<ReturnType<typeof spawn> | null>(null);

  // Initial check for FFmpeg
  useEffect(() => {
    const checkTimer = setTimeout(() => {
      const isInstalled = checkFFmpegInstalled();
      const version = getFFmpegVersion();
      setFfmpegVersion(version);

      if (isInstalled && !forceSetup) {
        setStep('already-installed');
      } else {
        const methods = getInstallMethods();
        setInstallMethods(methods);
        setStep('not-installed');
      }
    }, 1200);

    return () => clearTimeout(checkTimer);
  }, [forceSetup]);

  // Handle installation
  const startInstallation = (method: InstallMethod) => {
    if (method.id === 'manual') {
      setStep('manual-instructions');
      return;
    }

    setStep('installing');
    setInstallOutput([]);

    const parts = method.command.split(' ');
    const cmd = parts[0];
    const args = parts.slice(1);

    const proc = spawn(cmd, args, {
      shell: true,
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    installProcessRef.current = proc;

    proc.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(l => l.trim());
      setInstallOutput(prev => [...prev.slice(-8), ...lines].slice(-10));
    });

    proc.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(l => l.trim());
      setInstallOutput(prev => [...prev.slice(-8), ...lines].slice(-10));
    });

    proc.on('close', (code) => {
      if (code === 0) {
        setTimeout(() => {
          if (checkFFmpegInstalled()) {
            const version = getFFmpegVersion();
            setFfmpegVersion(version);
            setStep('install-success');
          } else {
            setErrorMessage('Installation completed but FFmpeg is not available. Restart your terminal.');
            setStep('install-error');
          }
        }, 500);
      } else {
        setErrorMessage(`Installation failed with exit code ${code}. Try manual installation.`);
        setStep('install-error');
      }
    });

    proc.on('error', (err) => {
      setErrorMessage(`Failed to start: ${err.message}`);
      setStep('install-error');
    });
  };

  // Handle user input
  useInput((input, key) => {
    if (step === 'not-installed') {
      if (key.return) {
        setStep('select-method');
      } else if (key.escape) {
        process.exit(0);
      }
    } else if (step === 'select-method') {
      const availableMethods = installMethods.filter(m => m.available);
      if (key.upArrow) {
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : availableMethods.length - 1));
      } else if (key.downArrow) {
        setSelectedIndex(prev => (prev < availableMethods.length - 1 ? prev + 1 : 0));
      } else if (key.return) {
        startInstallation(availableMethods[selectedIndex]);
      } else if (key.escape) {
        setStep('not-installed');
      }
    } else if (step === 'already-installed' || step === 'install-success') {
      if (key.return) {
        onComplete?.();
      } else if (key.escape) {
        process.exit(0);
      }
    } else if (step === 'install-error' || step === 'manual-instructions') {
      if (key.escape) {
        process.exit(0);
      } else if (input === 'r' || input === 'R') {
        setStep('select-method');
        setErrorMessage('');
        setInstallOutput([]);
      }
    }
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (installProcessRef.current) {
        installProcessRef.current.kill();
      }
    };
  }, []);

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box flexDirection="column">
        <Text bold color="#ff6b4a">Sqsh Setup</Text>
        <Text color="#999999">Configure your environment for media compression</Text>
      </Box>

      {/* Step: Checking */}
      {step === 'checking' && (
        <Box marginTop={1}>
          <Spinner label="Checking for FFmpeg..." />
        </Box>
      )}

      {/* Step: Already Installed */}
      {step === 'already-installed' && (
        <Box flexDirection="column" marginTop={1}>
          <Text>
            <Text color="#22c55e">{'\u2713'} </Text>
            <Text color="#22c55e" bold>FFmpeg</Text>
            <Text color="white"> is already installed</Text>
            {ffmpegVersion && <Text color="#666666"> (v{ffmpegVersion})</Text>}
          </Text>
          <Box marginTop={1}>
            <Text color="#999999">You're all set! Ready to compress media files.</Text>
          </Box>
          <Box marginTop={1}>
            <Text color="#666666">Enter to continue · Esc to exit</Text>
          </Box>
        </Box>
      )}

      {/* Step: Not Installed */}
      {step === 'not-installed' && (
        <Box flexDirection="column" marginTop={1}>
          <Text>
            <Text color="#ef4444">{'\u2717'} </Text>
            <Text color="#ef4444" bold>FFmpeg</Text>
            <Text color="white"> is not installed</Text>
          </Text>
          <Box marginTop={1}>
            <Text color="#999999">FFmpeg is required to compress media files. We'll help you install it.</Text>
          </Box>
          <Box marginTop={1}>
            <Text color="#666666">Enter to install · Esc to exit</Text>
          </Box>
        </Box>
      )}

      {/* Step: Select Method */}
      {step === 'select-method' && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="yellow">Select installation method:</Text>
          <Box marginTop={1} flexDirection="column">
            {installMethods.filter(m => m.available).map((method, index) => {
              const isSelected = selectedIndex === index;
              return (
                <Box key={method.id} flexDirection="column">
                  <Box flexDirection="row">
                    <Text color={isSelected ? '#a855f7' : 'white'}>
                      {isSelected ? '> ' : '  '}{index + 1}. {method.name}
                    </Text>
                    {method.id === 'brew' && <Text color="#22c55e"> (Recommended)</Text>}
                  </Box>
                  <Box marginLeft={5}>
                    <Text color="#666666">{method.description}</Text>
                    {method.command && <Text color="#444444"> · {method.command}</Text>}
                  </Box>
                </Box>
              );
            })}
          </Box>
          {installMethods.filter(m => !m.available).length > 0 && (
            <Box marginTop={1}>
              {installMethods.filter(m => !m.available).map(method => (
                <Text key={method.id} color="#444444" strikethrough>
                  {method.name} - not found
                </Text>
              ))}
            </Box>
          )}
          <Box marginTop={1}>
            <Text color="#666666">Enter to confirm · ↑/↓ to navigate</Text>
          </Box>
        </Box>
      )}

      {/* Step: Installing */}
      {step === 'installing' && (
        <Box flexDirection="column" marginTop={1}>
          <Spinner label="Installing FFmpeg..." />
          {installOutput.length > 0 && (
            <Box flexDirection="column" marginTop={1} marginLeft={2}>
              {installOutput.slice(-6).map((line, i) => (
                <Text key={i} color="#666666" wrap="truncate">
                  {line.slice(0, 70)}
                </Text>
              ))}
            </Box>
          )}
          <Box marginTop={1}>
            <Text color="#666666">This may take a few minutes...</Text>
          </Box>
        </Box>
      )}

      {/* Step: Install Success */}
      {step === 'install-success' && (
        <Box flexDirection="column" marginTop={1}>
          <Text>
            <Text color="#22c55e">{'\u2713'} </Text>
            <Text color="#22c55e" bold>FFmpeg</Text>
            <Text color="white"> installed successfully</Text>
            {ffmpegVersion && <Text color="#666666"> (v{ffmpegVersion})</Text>}
          </Text>
          <Box marginTop={1}>
            <Text color="#999999">Sqsh is ready to compress media files.</Text>
          </Box>
          <Box marginTop={1}>
            <Text color="#666666">Enter to continue · Esc to exit</Text>
          </Box>
        </Box>
      )}

      {/* Step: Install Error */}
      {step === 'install-error' && (
        <Box flexDirection="column" marginTop={1}>
          <Text>
            <Text color="#ef4444">{'\u2717'} </Text>
            <Text color="#ef4444" bold>Installation failed</Text>
          </Text>
          <Box marginTop={1}>
            <Text color="#999999">{errorMessage}</Text>
          </Box>
          <Box marginTop={1}>
            <Text color="#666666">R to retry · Esc to exit</Text>
          </Box>
        </Box>
      )}

      {/* Step: Manual Instructions */}
      {step === 'manual-instructions' && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="yellow">Manual Installation</Text>
          <Box marginTop={1} flexDirection="column">
            {process.platform === 'darwin' && (
              <>
                <Text color="#999999">1. Install Homebrew (if not installed):</Text>
                <Text color="cyan">   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"</Text>
                <Text color="#999999">2. Install FFmpeg:</Text>
                <Text color="cyan">   brew install ffmpeg</Text>
              </>
            )}
            {process.platform === 'linux' && (
              <>
                <Text color="#999999">Debian/Ubuntu:</Text>
                <Text color="cyan">   sudo apt-get update && sudo apt-get install ffmpeg</Text>
                <Text color="#999999">CentOS/RHEL:</Text>
                <Text color="cyan">   sudo yum install ffmpeg</Text>
              </>
            )}
            {process.platform === 'win32' && (
              <>
                <Text color="#999999">1. Download from: https://ffmpeg.org/download.html</Text>
                <Text color="#999999">2. Extract and add to PATH</Text>
              </>
            )}
          </Box>
          <Box marginTop={1}>
            <Text color="#999999">After installing, run </Text>
            <Text color="cyan">sqsh</Text>
            <Text color="#999999"> again to verify.</Text>
          </Box>
          <Box marginTop={1}>
            <Text color="#666666">R to go back · Esc to exit</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};
