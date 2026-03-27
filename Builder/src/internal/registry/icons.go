package registry

import (
	"fmt"
	"strings"
)

// IconInfo describes an individual Lucide React icon
type IconInfo struct {
	Name        string
	Description string
	Tags        []string
}

// IconCategory represents a group of related icons
type IconCategory struct {
	Name        string
	Description string
	Icons       []IconInfo
}

// IconCategories contains all Lucide React icons organized by category
var IconCategories = map[string]IconCategory{
	"Navigation": {
		Name:        "Navigation",
		Description: "Arrows, chevrons, and directional icons for navigation",
		Icons: []IconInfo{
			{Name: "ArrowLeft", Description: "Left arrow for back navigation", Tags: []string{"back", "previous", "left", "arrow"}},
			{Name: "ArrowRight", Description: "Right arrow for forward navigation", Tags: []string{"forward", "next", "right", "arrow"}},
			{Name: "ArrowUp", Description: "Up arrow", Tags: []string{"up", "top", "arrow"}},
			{Name: "ArrowDown", Description: "Down arrow", Tags: []string{"down", "bottom", "arrow"}},
			{Name: "ArrowUpRight", Description: "Up-right diagonal arrow", Tags: []string{"external", "link", "arrow"}},
			{Name: "ArrowDownLeft", Description: "Down-left diagonal arrow", Tags: []string{"arrow", "diagonal"}},
			{Name: "ChevronLeft", Description: "Left chevron", Tags: []string{"back", "collapse", "left", "chevron"}},
			{Name: "ChevronRight", Description: "Right chevron", Tags: []string{"forward", "expand", "right", "chevron"}},
			{Name: "ChevronUp", Description: "Up chevron", Tags: []string{"up", "collapse", "chevron"}},
			{Name: "ChevronDown", Description: "Down chevron", Tags: []string{"down", "expand", "dropdown", "chevron"}},
			{Name: "ChevronsLeft", Description: "Double left chevron", Tags: []string{"first", "start", "chevron"}},
			{Name: "ChevronsRight", Description: "Double right chevron", Tags: []string{"last", "end", "chevron"}},
			{Name: "ChevronsUp", Description: "Double up chevron", Tags: []string{"up", "expand", "chevron"}},
			{Name: "ChevronsDown", Description: "Double down chevron", Tags: []string{"down", "collapse", "chevron"}},
			{Name: "Home", Description: "Home navigation", Tags: []string{"home", "house", "main", "start"}},
			{Name: "Menu", Description: "Menu hamburger", Tags: []string{"menu", "hamburger", "navigation", "bars"}},
			{Name: "CornerUpLeft", Description: "Return/undo arrow", Tags: []string{"back", "return", "undo", "arrow"}},
			{Name: "ExternalLink", Description: "External link", Tags: []string{"external", "link", "open", "new"}},
		},
	},
	"Actions": {
		Name:        "Actions",
		Description: "Common action icons for buttons and interactions",
		Icons: []IconInfo{
			{Name: "Plus", Description: "Add or create new item", Tags: []string{"add", "create", "new", "plus"}},
			{Name: "PlusCircle", Description: "Add in circle", Tags: []string{"add", "create", "new", "plus", "circle"}},
			{Name: "Minus", Description: "Remove or subtract", Tags: []string{"remove", "subtract", "minus"}},
			{Name: "MinusCircle", Description: "Remove in circle", Tags: []string{"remove", "subtract", "minus", "circle"}},
			{Name: "Trash2", Description: "Delete item", Tags: []string{"delete", "remove", "trash", "bin"}},
			{Name: "Trash", Description: "Trash can", Tags: []string{"delete", "remove", "trash"}},
			{Name: "Pencil", Description: "Edit item", Tags: []string{"edit", "modify", "pencil", "write"}},
			{Name: "PenSquare", Description: "Edit in square", Tags: []string{"edit", "modify", "pencil", "write", "square"}},
			{Name: "Check", Description: "Confirm or complete", Tags: []string{"check", "confirm", "done", "yes", "success"}},
			{Name: "X", Description: "Close or cancel", Tags: []string{"close", "cancel", "x", "remove", "dismiss"}},
			{Name: "RefreshCw", Description: "Refresh or reload", Tags: []string{"refresh", "reload", "sync", "update"}},
			{Name: "RotateCw", Description: "Rotate clockwise", Tags: []string{"rotate", "redo", "refresh"}},
			{Name: "Download", Description: "Download", Tags: []string{"download", "save", "export"}},
			{Name: "Upload", Description: "Upload", Tags: []string{"upload", "import"}},
			{Name: "Copy", Description: "Copy to clipboard", Tags: []string{"copy", "clipboard", "duplicate"}},
			{Name: "Clipboard", Description: "Clipboard", Tags: []string{"copy", "clipboard", "paste"}},
			{Name: "Share2", Description: "Share content", Tags: []string{"share", "send", "export"}},
			{Name: "Link", Description: "Link or URL", Tags: []string{"link", "url", "chain"}},
			{Name: "Link2", Description: "Link variant", Tags: []string{"link", "url", "chain"}},
			{Name: "Bookmark", Description: "Bookmark item", Tags: []string{"bookmark", "save", "favorite"}},
			{Name: "Archive", Description: "Archive item", Tags: []string{"archive", "store", "box"}},
			{Name: "Send", Description: "Send message", Tags: []string{"send", "submit", "message"}},
			{Name: "Save", Description: "Save item", Tags: []string{"save", "disk", "store"}},
		},
	},
	"Status": {
		Name:        "Status",
		Description: "Status and notification icons",
		Icons: []IconInfo{
			{Name: "CheckCircle", Description: "Success status", Tags: []string{"success", "done", "complete", "check"}},
			{Name: "CheckCircle2", Description: "Success check circle", Tags: []string{"success", "done", "complete"}},
			{Name: "AlertCircle", Description: "Warning status", Tags: []string{"warning", "alert", "caution", "info"}},
			{Name: "AlertTriangle", Description: "Warning triangle", Tags: []string{"warning", "alert", "danger", "triangle"}},
			{Name: "Info", Description: "Information", Tags: []string{"info", "information", "help", "about"}},
			{Name: "HelpCircle", Description: "Help or question", Tags: []string{"help", "question", "support", "faq"}},
			{Name: "XCircle", Description: "Error status", Tags: []string{"error", "failed", "cancel", "close"}},
			{Name: "Clock", Description: "Time or pending", Tags: []string{"time", "clock", "pending", "wait"}},
			{Name: "Timer", Description: "Timer countdown", Tags: []string{"timer", "countdown", "time"}},
			{Name: "Calendar", Description: "Date or schedule", Tags: []string{"date", "calendar", "schedule", "event"}},
			{Name: "CalendarDays", Description: "Calendar with days", Tags: []string{"date", "calendar", "schedule"}},
			{Name: "Bell", Description: "Notification", Tags: []string{"notification", "alert", "bell", "notify"}},
			{Name: "BellRing", Description: "Ringing notification", Tags: []string{"notification", "alert", "bell", "urgent"}},
			{Name: "BellOff", Description: "Notifications off", Tags: []string{"notification", "mute", "silent", "off"}},
			{Name: "Shield", Description: "Security shield", Tags: []string{"security", "safe", "protected"}},
			{Name: "ShieldCheck", Description: "Secure or verified", Tags: []string{"security", "verified", "safe", "protected"}},
			{Name: "ShieldAlert", Description: "Security warning", Tags: []string{"security", "warning", "risk"}},
			{Name: "Lock", Description: "Locked", Tags: []string{"lock", "secure", "private", "closed"}},
			{Name: "Unlock", Description: "Unlocked", Tags: []string{"unlock", "open", "public"}},
			{Name: "Key", Description: "Key", Tags: []string{"key", "password", "access", "security"}},
			{Name: "Loader2", Description: "Loading spinner", Tags: []string{"loading", "spinner", "wait"}},
		},
	},
	"Media": {
		Name:        "Media",
		Description: "Document, file, and media icons",
		Icons: []IconInfo{
			{Name: "File", Description: "Document or file", Tags: []string{"document", "file", "page"}},
			{Name: "FileText", Description: "Text document", Tags: []string{"document", "file", "text", "page"}},
			{Name: "FilePlus", Description: "Add file", Tags: []string{"document", "file", "add", "new"}},
			{Name: "Files", Description: "Multiple files", Tags: []string{"document", "copy", "duplicate"}},
			{Name: "Folder", Description: "Folder", Tags: []string{"folder", "directory", "files"}},
			{Name: "FolderOpen", Description: "Open folder", Tags: []string{"folder", "open", "directory"}},
			{Name: "FolderPlus", Description: "New folder", Tags: []string{"folder", "new", "create", "add"}},
			{Name: "Image", Description: "Image or photo", Tags: []string{"image", "photo", "picture", "gallery"}},
			{Name: "ImagePlus", Description: "Add image", Tags: []string{"image", "photo", "add", "upload"}},
			{Name: "Video", Description: "Video", Tags: []string{"video", "film", "movie", "media"}},
			{Name: "Music", Description: "Music or audio", Tags: []string{"music", "audio", "sound", "song"}},
			{Name: "Mic", Description: "Microphone", Tags: []string{"microphone", "audio", "record", "voice"}},
			{Name: "Volume2", Description: "Sound on", Tags: []string{"sound", "audio", "volume", "speaker"}},
			{Name: "VolumeX", Description: "Sound off", Tags: []string{"mute", "silent", "volume", "off"}},
			{Name: "Play", Description: "Play media", Tags: []string{"play", "start", "media"}},
			{Name: "Pause", Description: "Pause media", Tags: []string{"pause", "stop", "media"}},
			{Name: "Square", Description: "Stop media", Tags: []string{"stop", "end", "media"}},
			{Name: "SkipBack", Description: "Skip back", Tags: []string{"previous", "back", "media"}},
			{Name: "SkipForward", Description: "Skip forward", Tags: []string{"next", "forward", "media"}},
		},
	},
	"UI": {
		Name:        "UI",
		Description: "User interface control icons",
		Icons: []IconInfo{
			{Name: "Menu", Description: "Menu hamburger", Tags: []string{"menu", "hamburger", "navigation", "bars"}},
			{Name: "MoreHorizontal", Description: "More options horizontal", Tags: []string{"more", "options", "menu", "dots"}},
			{Name: "MoreVertical", Description: "More options vertical", Tags: []string{"more", "options", "menu", "dots"}},
			{Name: "Settings", Description: "Settings gear", Tags: []string{"settings", "gear", "preferences", "config"}},
			{Name: "Settings2", Description: "Settings sliders", Tags: []string{"settings", "gear", "preferences"}},
			{Name: "SlidersHorizontal", Description: "Adjustments horizontal", Tags: []string{"settings", "adjust", "sliders", "filter"}},
			{Name: "SlidersVertical", Description: "Adjustments vertical", Tags: []string{"settings", "adjust", "sliders", "filter"}},
			{Name: "Filter", Description: "Filter", Tags: []string{"filter", "funnel", "sort"}},
			{Name: "Grid", Description: "Grid view", Tags: []string{"grid", "view", "layout", "squares"}},
			{Name: "LayoutGrid", Description: "Layout grid", Tags: []string{"grid", "view", "layout"}},
			{Name: "List", Description: "List view", Tags: []string{"list", "view", "layout", "bullet"}},
			{Name: "Columns", Description: "Columns view", Tags: []string{"columns", "view", "layout"}},
			{Name: "Table", Description: "Table view", Tags: []string{"table", "grid", "data"}},
			{Name: "Table2", Description: "Table variant", Tags: []string{"table", "grid", "data"}},
			{Name: "Maximize2", Description: "Expand fullscreen", Tags: []string{"expand", "fullscreen", "maximize"}},
			{Name: "Minimize2", Description: "Collapse fullscreen", Tags: []string{"collapse", "minimize", "exit"}},
			{Name: "Maximize", Description: "Maximize window", Tags: []string{"expand", "fullscreen", "maximize"}},
			{Name: "Minimize", Description: "Minimize window", Tags: []string{"collapse", "minimize"}},
			{Name: "PanelLeft", Description: "Panel left", Tags: []string{"panel", "sidebar", "layout"}},
			{Name: "PanelRight", Description: "Panel right", Tags: []string{"panel", "sidebar", "layout"}},
			{Name: "Layers", Description: "Layers", Tags: []string{"layers", "stack", "z-index"}},
		},
	},
	"Communication": {
		Name:        "Communication",
		Description: "Communication and messaging icons",
		Icons: []IconInfo{
			{Name: "Mail", Description: "Email", Tags: []string{"email", "mail", "message", "envelope"}},
			{Name: "MailOpen", Description: "Open email", Tags: []string{"email", "mail", "open", "read"}},
			{Name: "MessageSquare", Description: "Chat message", Tags: []string{"chat", "message", "comment", "bubble"}},
			{Name: "MessageCircle", Description: "Chat circle", Tags: []string{"chat", "message", "comment"}},
			{Name: "MessagesSquare", Description: "Conversation", Tags: []string{"chat", "conversation", "discuss", "messages"}},
			{Name: "Phone", Description: "Phone call", Tags: []string{"phone", "call", "contact", "telephone"}},
			{Name: "PhoneCall", Description: "Active call", Tags: []string{"phone", "call", "ringing"}},
			{Name: "PhoneOff", Description: "End call", Tags: []string{"phone", "call", "hangup", "end"}},
			{Name: "PhoneOutgoing", Description: "Outgoing call", Tags: []string{"phone", "call", "outgoing"}},
			{Name: "PhoneIncoming", Description: "Incoming call", Tags: []string{"phone", "call", "incoming"}},
			{Name: "Camera", Description: "Video call", Tags: []string{"video", "camera", "call", "meeting"}},
			{Name: "AtSign", Description: "At symbol", Tags: []string{"at", "email", "mention", "handle"}},
			{Name: "Hash", Description: "Hashtag", Tags: []string{"hashtag", "tag", "topic", "channel"}},
			{Name: "Send", Description: "Send message", Tags: []string{"send", "submit", "message", "airplane"}},
			{Name: "Inbox", Description: "Inbox", Tags: []string{"inbox", "mail", "messages"}},
			{Name: "Reply", Description: "Reply to message", Tags: []string{"reply", "respond", "message"}},
			{Name: "Forward", Description: "Forward message", Tags: []string{"forward", "send", "message"}},
		},
	},
	"Search": {
		Name:        "Search",
		Description: "Search and discovery icons",
		Icons: []IconInfo{
			{Name: "Search", Description: "Search", Tags: []string{"search", "find", "lookup", "magnify"}},
			{Name: "ZoomIn", Description: "Zoom in", Tags: []string{"zoom", "in", "magnify", "enlarge"}},
			{Name: "ZoomOut", Description: "Zoom out", Tags: []string{"zoom", "out", "magnify", "shrink"}},
			{Name: "ScanSearch", Description: "Scan search", Tags: []string{"search", "scan", "find"}},
			{Name: "Map", Description: "Map location", Tags: []string{"map", "location", "directions"}},
			{Name: "MapPin", Description: "Location pin", Tags: []string{"location", "pin", "marker", "place"}},
			{Name: "MapPinned", Description: "Pinned location", Tags: []string{"location", "pin", "marker", "saved"}},
			{Name: "Navigation", Description: "Navigation arrow", Tags: []string{"navigation", "direction", "compass"}},
			{Name: "Compass", Description: "Compass", Tags: []string{"compass", "direction", "navigation"}},
			{Name: "Globe", Description: "Globe", Tags: []string{"globe", "world", "international", "web"}},
			{Name: "Globe2", Description: "Globe variant", Tags: []string{"globe", "world", "earth"}},
			{Name: "Locate", Description: "Current location", Tags: []string{"location", "gps", "current", "position"}},
		},
	},
	"User": {
		Name:        "User",
		Description: "User and account icons",
		Icons: []IconInfo{
			{Name: "User", Description: "User profile", Tags: []string{"user", "profile", "account", "person"}},
			{Name: "UserCircle", Description: "User in circle", Tags: []string{"user", "profile", "avatar", "circle"}},
			{Name: "UserCircle2", Description: "User avatar", Tags: []string{"user", "profile", "avatar"}},
			{Name: "UserPlus", Description: "Add user", Tags: []string{"user", "add", "invite", "new"}},
			{Name: "UserMinus", Description: "Remove user", Tags: []string{"user", "remove", "delete"}},
			{Name: "UserX", Description: "Delete user", Tags: []string{"user", "remove", "delete", "block"}},
			{Name: "UserCheck", Description: "Verified user", Tags: []string{"user", "verified", "check", "approved"}},
			{Name: "Users", Description: "Multiple users", Tags: []string{"users", "people", "team", "group"}},
			{Name: "Users2", Description: "Group of users", Tags: []string{"users", "group", "team", "people"}},
			{Name: "Contact", Description: "Contact card", Tags: []string{"contact", "card", "person", "vcard"}},
			{Name: "BadgeCheck", Description: "Verified badge", Tags: []string{"verified", "badge", "check", "approved"}},
			{Name: "Fingerprint", Description: "Fingerprint", Tags: []string{"fingerprint", "biometric", "security", "identity"}},
			{Name: "Building2", Description: "Office building", Tags: []string{"office", "building", "company", "work"}},
			{Name: "Building", Description: "Building", Tags: []string{"building", "company", "organization"}},
			{Name: "GraduationCap", Description: "Education", Tags: []string{"education", "graduation", "school", "learning"}},
			{Name: "LogIn", Description: "Log in", Tags: []string{"login", "signin", "enter", "auth"}},
			{Name: "LogOut", Description: "Log out", Tags: []string{"logout", "signout", "exit", "auth"}},
		},
	},
	"Commerce": {
		Name:        "Commerce",
		Description: "Shopping and commerce icons",
		Icons: []IconInfo{
			{Name: "ShoppingCart", Description: "Shopping cart", Tags: []string{"cart", "shopping", "buy", "checkout"}},
			{Name: "ShoppingBag", Description: "Shopping bag", Tags: []string{"bag", "shopping", "purchase", "store"}},
			{Name: "CreditCard", Description: "Credit card", Tags: []string{"card", "payment", "credit", "pay"}},
			{Name: "Wallet", Description: "Wallet", Tags: []string{"wallet", "payment", "money"}},
			{Name: "Banknote", Description: "Cash money", Tags: []string{"money", "cash", "payment", "currency"}},
			{Name: "DollarSign", Description: "Dollar sign", Tags: []string{"dollar", "money", "currency", "price"}},
			{Name: "Euro", Description: "Euro sign", Tags: []string{"euro", "money", "currency"}},
			{Name: "Percent", Description: "Percent discount", Tags: []string{"discount", "sale", "percent", "coupon"}},
			{Name: "Receipt", Description: "Receipt", Tags: []string{"receipt", "invoice", "order", "bill"}},
			{Name: "Tag", Description: "Price tag", Tags: []string{"tag", "price", "label", "sale"}},
			{Name: "Tags", Description: "Multiple tags", Tags: []string{"tags", "labels", "categories"}},
			{Name: "Gift", Description: "Gift", Tags: []string{"gift", "present", "reward", "bonus"}},
			{Name: "Truck", Description: "Delivery truck", Tags: []string{"delivery", "shipping", "truck", "transport"}},
			{Name: "Package", Description: "Package", Tags: []string{"package", "box", "delivery", "product"}},
			{Name: "Store", Description: "Store", Tags: []string{"store", "shop", "retail", "business"}},
			{Name: "Barcode", Description: "Barcode", Tags: []string{"barcode", "scan", "product", "inventory"}},
			{Name: "QrCode", Description: "QR code", Tags: []string{"qr", "code", "scan", "link"}},
		},
	},
	"Social": {
		Name:        "Social",
		Description: "Social and engagement icons",
		Icons: []IconInfo{
			{Name: "Heart", Description: "Like or love", Tags: []string{"heart", "like", "love", "favorite"}},
			{Name: "HeartOff", Description: "Unlike", Tags: []string{"heart", "unlike", "remove"}},
			{Name: "Star", Description: "Star rating", Tags: []string{"star", "rating", "favorite", "bookmark"}},
			{Name: "StarOff", Description: "Unstar", Tags: []string{"star", "rating", "remove"}},
			{Name: "ThumbsUp", Description: "Thumbs up", Tags: []string{"like", "approve", "thumbs", "up"}},
			{Name: "ThumbsDown", Description: "Thumbs down", Tags: []string{"dislike", "reject", "thumbs", "down"}},
			{Name: "Smile", Description: "Happy face", Tags: []string{"happy", "smile", "emoji", "positive"}},
			{Name: "Frown", Description: "Sad face", Tags: []string{"sad", "frown", "emoji", "negative"}},
			{Name: "Meh", Description: "Neutral face", Tags: []string{"neutral", "meh", "emoji"}},
			{Name: "Hand", Description: "Hand raised", Tags: []string{"hand", "stop", "wave", "hello"}},
			{Name: "Flame", Description: "Fire trending", Tags: []string{"fire", "hot", "trending", "popular"}},
			{Name: "Sparkles", Description: "Sparkles", Tags: []string{"sparkles", "new", "magic", "special"}},
			{Name: "Trophy", Description: "Trophy award", Tags: []string{"trophy", "award", "winner", "achievement"}},
			{Name: "Award", Description: "Award medal", Tags: []string{"award", "medal", "achievement", "prize"}},
			{Name: "Flag", Description: "Flag", Tags: []string{"flag", "report", "mark", "country"}},
			{Name: "Eye", Description: "View or visible", Tags: []string{"view", "visible", "eye", "watch"}},
			{Name: "EyeOff", Description: "Hidden", Tags: []string{"hidden", "invisible", "eye", "hide"}},
			{Name: "Share", Description: "Share", Tags: []string{"share", "social", "post"}},
		},
	},
	"Data": {
		Name:        "Data",
		Description: "Charts, data, and analytics icons",
		Icons: []IconInfo{
			{Name: "BarChart", Description: "Bar chart", Tags: []string{"chart", "bar", "analytics", "stats"}},
			{Name: "BarChart2", Description: "Bar chart variant", Tags: []string{"chart", "bar", "analytics"}},
			{Name: "BarChart3", Description: "Horizontal bar chart", Tags: []string{"chart", "bar", "horizontal"}},
			{Name: "LineChart", Description: "Line chart", Tags: []string{"chart", "line", "analytics", "trend"}},
			{Name: "PieChart", Description: "Pie chart", Tags: []string{"chart", "pie", "analytics", "stats"}},
			{Name: "TrendingUp", Description: "Trending up", Tags: []string{"trend", "up", "increase", "growth"}},
			{Name: "TrendingDown", Description: "Trending down", Tags: []string{"trend", "down", "decrease", "decline"}},
			{Name: "Activity", Description: "Activity monitor", Tags: []string{"activity", "pulse", "health", "monitor"}},
			{Name: "Database", Description: "Database", Tags: []string{"database", "storage", "data"}},
			{Name: "HardDrive", Description: "Hard drive", Tags: []string{"storage", "disk", "drive", "data"}},
			{Name: "Server", Description: "Server", Tags: []string{"server", "hosting", "backend"}},
			{Name: "Cloud", Description: "Cloud", Tags: []string{"cloud", "storage", "upload", "sync"}},
			{Name: "CloudUpload", Description: "Cloud upload", Tags: []string{"cloud", "upload", "sync"}},
			{Name: "CloudDownload", Description: "Cloud download", Tags: []string{"cloud", "download", "sync"}},
		},
	},
}

// GetAllIconCategories returns a formatted list of all icon categories
func GetAllIconCategories() string {
	var sb strings.Builder
	sb.WriteString("Lucide React Icon Categories:\n\n")

	for name, category := range IconCategories {
		fmt.Fprintf(&sb, "• %s (%d icons): %s\n", name, len(category.Icons), category.Description)
	}

	sb.WriteString("\nUse listIcons with a category name to see icons, or use getIconUsage with an icon name for import statements.")
	return sb.String()
}

// GetIconsByCategory returns all icons in a specific category
func GetIconsByCategory(categoryName string) string {
	category, exists := IconCategories[categoryName]
	if !exists {
		return fmt.Sprintf("Category '%s' not found. Use listIcons without parameters to see all categories.", categoryName)
	}

	var sb strings.Builder
	fmt.Fprintf(&sb, "## %s\n%s\n\n", category.Name, category.Description)

	for _, icon := range category.Icons {
		fmt.Fprintf(&sb, "• %s: %s\n", icon.Name, icon.Description)
	}

	sb.WriteString("\nUse getIconUsage with an icon name for import statements and examples.")
	return sb.String()
}

// SearchIcons searches for icons by name or tag (case-insensitive)
func SearchIcons(query string) string {
	query = strings.ToLower(query)
	var results []IconInfo

	for _, category := range IconCategories {
		for _, icon := range category.Icons {
			// Check if query matches icon name
			if strings.Contains(strings.ToLower(icon.Name), query) {
				results = append(results, icon)
				continue
			}

			// Check if query matches any tag
			for _, tag := range icon.Tags {
				if strings.Contains(strings.ToLower(tag), query) {
					results = append(results, icon)
					break
				}
			}
		}
	}

	if len(results) == 0 {
		return fmt.Sprintf("No icons found matching '%s'. Try a different search term or browse categories with listIcons.", query)
	}

	var sb strings.Builder
	fmt.Fprintf(&sb, "Found %d icons matching '%s':\n\n", len(results), query)

	for _, icon := range results {
		fmt.Fprintf(&sb, "• %s: %s\n", icon.Name, icon.Description)
	}

	sb.WriteString("\nUse getIconUsage with an icon name for import statements.")
	return sb.String()
}

// GetIconUsage returns detailed usage info for a specific icon
func GetIconUsage(iconName string) string {
	// Find the icon in any category
	var foundIcon *IconInfo
	for _, category := range IconCategories {
		for _, icon := range category.Icons {
			if strings.EqualFold(icon.Name, iconName) {
				foundIcon = &icon
				break
			}
		}
		if foundIcon != nil {
			break
		}
	}

	if foundIcon == nil {
		return fmt.Sprintf("Icon '%s' not found. Use listIcons to search for available icons.", iconName)
	}

	var sb strings.Builder
	fmt.Fprintf(&sb, "## %s\n\n", foundIcon.Name)
	fmt.Fprintf(&sb, "%s\n\n", foundIcon.Description)

	sb.WriteString("### Import\n\n")
	fmt.Fprintf(&sb, "```tsx\nimport { %s } from 'lucide-react';\n```\n\n", foundIcon.Name)

	sb.WriteString("### Usage Examples\n\n")
	fmt.Fprintf(&sb, "```tsx\n// Basic usage\n<%s className=\"h-6 w-6\" />\n\n", foundIcon.Name)
	fmt.Fprintf(&sb, "// With color\n<%s className=\"h-6 w-6 text-blue-500\" />\n\n", foundIcon.Name)
	fmt.Fprintf(&sb, "// Smaller size\n<%s className=\"h-4 w-4\" />\n\n", foundIcon.Name)
	fmt.Fprintf(&sb, "// Larger size\n<%s className=\"h-8 w-8\" />\n\n", foundIcon.Name)
	fmt.Fprintf(&sb, "// In a button\n<Button>\n  <%s className=\"h-5 w-5 mr-2\" />\n  Button Text\n</Button>\n\n", foundIcon.Name)
	fmt.Fprintf(&sb, "// With stroke width\n<%s className=\"h-6 w-6\" strokeWidth={1.5} />\n```", foundIcon.Name)

	return sb.String()
}
