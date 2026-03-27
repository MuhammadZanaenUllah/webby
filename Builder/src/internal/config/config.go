package config

import (
	"flag"
	"fmt"
	"os"

	"github.com/spf13/viper"
)

// Config holds all configuration for the application
type Config struct {
	Host  string `mapstructure:"host"`
	Port  int    `mapstructure:"port"`
	Key   string `mapstructure:"key"`
	Debug bool   `mapstructure:"debug"`
}

// CLIFlags holds command-line flag values
type CLIFlags struct {
	Host     *string
	Port     *int
	Key      *string
	Debug    *bool
	ShowHelp *bool
}

// Load loads configuration from config file
func Load() (*Config, error) {
	v := viper.New()

	// Set config file - JSON only
	v.SetConfigName("config")
	v.SetConfigType("json")
	v.AddConfigPath(".")
	v.AddConfigPath("./config")

	// Set defaults
	v.SetDefault("host", "0.0.0.0")
	v.SetDefault("port", 8080)
	v.SetDefault("key", "")
	v.SetDefault("debug", false)

	// Environment variables
	v.AutomaticEnv()
	v.SetEnvPrefix("WEBBY")

	// Read config file (optional)
	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, err
		}
	}

	var config Config
	if err := v.Unmarshal(&config); err != nil {
		return nil, err
	}

	return &config, nil
}

// LoadWithCLI loads configuration and merges with CLI flags (CLI takes priority)
func LoadWithCLI(version string) (*Config, error) {
	// Parse CLI flags
	flags := parseCLIFlags(version)

	// Show help if explicitly requested
	if *flags.ShowHelp {
		showHelp(version)
		os.Exit(0)
	}

	// Load base configuration
	cfg, err := Load()
	if err != nil {
		return nil, err
	}

	// Merge CLI flags with priority (CLI overrides config.json)
	mergeFlags(cfg, flags)

	// Validate final configuration
	if err := cfg.Validate(); err != nil {
		return nil, err
	}

	return cfg, nil
}

// parseCLIFlags parses command-line flags
func parseCLIFlags(version string) *CLIFlags {
	flags := &CLIFlags{
		Host:     flag.String("host", "", "Server bind address (overrides config.host)"),
		Port:     flag.Int("port", 0, "Server port (overrides config.port)"),
		Key:      flag.String("key", "", "Server authentication key (overrides config.key)"),
		Debug:    flag.Bool("debug", false, "Enable debug mode (overrides config.debug)"),
		ShowHelp: flag.Bool("help", false, "Show help message"),
	}

	flag.Parse()
	return flags
}

// mergeFlags merges CLI flags into config with CLI priority
func mergeFlags(cfg *Config, flags *CLIFlags) {
	if *flags.Host != "" {
		cfg.Host = *flags.Host
	}
	if *flags.Port > 0 {
		cfg.Port = *flags.Port
	}
	if *flags.Key != "" {
		cfg.Key = *flags.Key
	}
	if isFlagSet("debug") {
		cfg.Debug = *flags.Debug
	}
}

// isFlagSet checks if a flag was explicitly provided on command line
func isFlagSet(name string) bool {
	found := false
	flag.Visit(func(f *flag.Flag) {
		if f.Name == name {
			found = true
		}
	})
	return found
}

// Validate validates the final configuration
func (c *Config) Validate() error {
	if c.Port <= 0 || c.Port > 65535 {
		return fmt.Errorf("invalid port: %d", c.Port)
	}

	if c.Key == "" {
		return fmt.Errorf("key is required (provide via config.json or --key flag)")
	}

	return nil
}

// showHelp displays usage information
func showHelp(version string) {
	fmt.Printf("\n")
	fmt.Printf("🌐 WEBBY BUILDER (v%s)\n\n", version)

	fmt.Println("USAGE:")
	fmt.Println("  ./webby-builder [OPTIONS]")

	fmt.Println("\nCONFIGURATION:")
	fmt.Println("  • Primary: config.json file (optional)")
	fmt.Println("  • Override: CLI flags (takes priority when provided)")
	fmt.Println("  • Environment: WEBBY_* variables")

	fmt.Println("\nCLI FLAGS:")
	fmt.Printf("  %-25s %s\n", "--host STRING", "Server bind address (default: 0.0.0.0)")
	fmt.Printf("  %-25s %s\n", "--port INT", "Server port (default: 8080)")
	fmt.Printf("  %-25s %s\n", "--key STRING", "Server authentication key (required)")
	fmt.Printf("  %-25s %s\n", "--debug", "Enable debug mode (default: false)")
	fmt.Printf("  %-25s %s\n", "--help", "Show this help message")

	fmt.Println("\nEXAMPLES:")
	fmt.Println("  Using config.json:")
	fmt.Println("    ./webby-builder")
	fmt.Println("    → Reads key from config.json")

	fmt.Println("\n  CLI override:")
	fmt.Println("    ./webby-builder --key=\"abc123\" --port=9000")
	fmt.Println("    → Uses config.json + overrides specified values")

	fmt.Println("\n  Full CLI:")
	fmt.Println("    ./webby-builder --key=\"abc123\" --port=8080 --debug")
	fmt.Println("    → All values from CLI flags")

	fmt.Println("\nCONFIG.JSON EXAMPLE:")
	fmt.Printf("  {\n")
	fmt.Printf("    \"host\": \"0.0.0.0\",\n")
	fmt.Printf("    \"port\": 8080,\n")
	fmt.Printf("    \"key\": \"your-key-here\",\n")
	fmt.Printf("    \"debug\": false\n")
	fmt.Printf("  }\n\n")
	fmt.Println("NOTE: Storage is hardcoded to ./storage and templates are fetched from Laravel API.")
	fmt.Println()
}
