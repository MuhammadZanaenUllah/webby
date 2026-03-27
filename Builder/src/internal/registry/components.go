package registry

import (
	"fmt"
	"strings"
)

// ComponentInfo describes an available shadcn/ui component
type ComponentInfo struct {
	Name        string
	Description string
	Import      string
	Example     string
	Variants    []string
}

// ComponentRegistry contains all available shadcn/ui components
var ComponentRegistry = map[string]ComponentInfo{
	"Button": {
		Name:        "Button",
		Description: "Interactive button with multiple style variants for actions and CTAs",
		Import:      `import { Button } from "@/components/ui/button"`,
		Example:     `<Button variant="default">Click me</Button>`,
		Variants:    []string{"default", "destructive", "outline", "secondary", "ghost", "link"},
	},
	"Card": {
		Name:        "Card",
		Description: "Container for grouped content with optional header, content, and footer sections",
		Import:      `import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"`,
		Example: `<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description here</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Card content goes here</p>
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>`,
		Variants: []string{},
	},
	"Input": {
		Name:        "Input",
		Description: "Text input field for forms with consistent styling",
		Import:      `import { Input } from "@/components/ui/input"`,
		Example:     `<Input type="email" placeholder="Email address" />`,
		Variants:    []string{},
	},
	"Label": {
		Name:        "Label",
		Description: "Accessible label for form inputs",
		Import:      `import { Label } from "@/components/ui/label"`,
		Example: `<div className="grid gap-2">
  <Label htmlFor="email">Email</Label>
  <Input id="email" type="email" />
</div>`,
		Variants: []string{},
	},
	"Textarea": {
		Name:        "Textarea",
		Description: "Multi-line text input for longer content like messages or descriptions",
		Import:      `import { Textarea } from "@/components/ui/textarea"`,
		Example:     `<Textarea placeholder="Type your message here" />`,
		Variants:    []string{},
	},
	"Dialog": {
		Name:        "Dialog",
		Description: "Modal dialog/popup for confirmations, forms, or important messages",
		Import:      `import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"`,
		Example: `<Dialog>
  <DialogTrigger asChild>
    <Button>Open Dialog</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Dialog Title</DialogTitle>
      <DialogDescription>Dialog description here</DialogDescription>
    </DialogHeader>
    <p>Dialog content goes here</p>
    <DialogFooter>
      <Button>Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>`,
		Variants: []string{},
	},
	"Tabs": {
		Name:        "Tabs",
		Description: "Tabbed interface for organizing content into switchable panels",
		Import:      `import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"`,
		Example: `<Tabs defaultValue="tab1">
  <TabsList>
    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
    <TabsTrigger value="tab2">Tab 2</TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">Content for tab 1</TabsContent>
  <TabsContent value="tab2">Content for tab 2</TabsContent>
</Tabs>`,
		Variants: []string{},
	},
	"Accordion": {
		Name:        "Accordion",
		Description: "Collapsible sections for FAQs, expandable content, or organized lists",
		Import:      `import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"`,
		Example: `<Accordion type="single" collapsible>
  <AccordionItem value="item-1">
    <AccordionTrigger>Is it accessible?</AccordionTrigger>
    <AccordionContent>Yes, it follows WAI-ARIA guidelines.</AccordionContent>
  </AccordionItem>
  <AccordionItem value="item-2">
    <AccordionTrigger>Can I customize it?</AccordionTrigger>
    <AccordionContent>Yes, you can style it with Tailwind CSS.</AccordionContent>
  </AccordionItem>
</Accordion>`,
		Variants: []string{},
	},
	"Alert": {
		Name:        "Alert",
		Description: "Status messages for success, warning, error, or informational notifications",
		Import:      `import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"`,
		Example: `<Alert>
  <AlertTitle>Heads up!</AlertTitle>
  <AlertDescription>This is an important message.</AlertDescription>
</Alert>`,
		Variants: []string{"default", "destructive"},
	},
	"Avatar": {
		Name:        "Avatar",
		Description: "User profile image with fallback initials",
		Import:      `import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"`,
		Example: `<Avatar>
  <AvatarImage src="https://example.com/avatar.jpg" alt="User" />
  <AvatarFallback>JD</AvatarFallback>
</Avatar>`,
		Variants: []string{},
	},
	"Badge": {
		Name:        "Badge",
		Description: "Small status indicators or labels for tags, categories, or counts",
		Import:      `import { Badge } from "@/components/ui/badge"`,
		Example:     `<Badge variant="default">New</Badge>`,
		Variants:    []string{"default", "secondary", "destructive", "outline"},
	},
	"Checkbox": {
		Name:        "Checkbox",
		Description: "Checkable input for boolean options or multi-select forms",
		Import:      `import { Checkbox } from "@/components/ui/checkbox"`,
		Example: `<div className="flex items-center space-x-2">
  <Checkbox id="terms" />
  <Label htmlFor="terms">Accept terms and conditions</Label>
</div>`,
		Variants: []string{},
	},
	"Select": {
		Name:        "Select",
		Description: "Dropdown menu for selecting from a list of options",
		Import:      `import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"`,
		Example: `<Select>
  <SelectTrigger>
    <SelectValue placeholder="Select an option" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">Option 1</SelectItem>
    <SelectItem value="option2">Option 2</SelectItem>
    <SelectItem value="option3">Option 3</SelectItem>
  </SelectContent>
</Select>`,
		Variants: []string{},
	},
	"Separator": {
		Name:        "Separator",
		Description: "Visual divider between sections or content blocks",
		Import:      `import { Separator } from "@/components/ui/separator"`,
		Example:     `<Separator className="my-4" />`,
		Variants:    []string{},
	},
	"Switch": {
		Name:        "Switch",
		Description: "Toggle switch for on/off settings",
		Import:      `import { Switch } from "@/components/ui/switch"`,
		Example: `<div className="flex items-center space-x-2">
  <Switch id="airplane-mode" />
  <Label htmlFor="airplane-mode">Airplane Mode</Label>
</div>`,
		Variants: []string{},
	},
	"Tooltip": {
		Name:        "Tooltip",
		Description: "Hover tooltip for additional context or help text",
		Import:      `import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"`,
		Example: `<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="outline">Hover me</Button>
    </TooltipTrigger>
    <TooltipContent>
      <p>This is a tooltip</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>`,
		Variants: []string{},
	},
	"Skeleton": {
		Name:        "Skeleton",
		Description: "Loading placeholder animation for content that is still loading",
		Import:      `import { Skeleton } from "@/components/ui/skeleton"`,
		Example: `<div className="space-y-2">
  <Skeleton className="h-4 w-[250px]" />
  <Skeleton className="h-4 w-[200px]" />
  <Skeleton className="h-12 w-12 rounded-full" />
</div>`,
		Variants: []string{},
	},
	"Table": {
		Name:        "Table",
		Description: "Data table with header, body, and styled rows for displaying structured data",
		Import:      `import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table"`,
		Example: `<Table>
  <TableCaption>A list of your recent invoices.</TableCaption>
  <TableHeader>
    <TableRow>
      <TableHead>Invoice</TableHead>
      <TableHead>Status</TableHead>
      <TableHead className="text-right">Amount</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>INV001</TableCell>
      <TableCell>Paid</TableCell>
      <TableCell className="text-right">$250.00</TableCell>
    </TableRow>
  </TableBody>
</Table>`,
		Variants: []string{},
	},
	"Progress": {
		Name:        "Progress",
		Description: "Progress bar indicator for showing completion percentage of tasks or loading states",
		Import:      `import { Progress } from "@/components/ui/progress"`,
		Example:     `<Progress value={33} className="w-[60%]" />`,
		Variants:    []string{},
	},
	"Sheet": {
		Name:        "Sheet",
		Description: "Slide-out panel from screen edge for navigation, forms, or secondary content",
		Import:      `import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from "@/components/ui/sheet"`,
		Example: `<Sheet>
  <SheetTrigger asChild>
    <Button variant="outline">Open</Button>
  </SheetTrigger>
  <SheetContent>
    <SheetHeader>
      <SheetTitle>Edit profile</SheetTitle>
      <SheetDescription>Make changes to your profile here.</SheetDescription>
    </SheetHeader>
    <div className="py-4">Sheet content here</div>
    <SheetFooter>
      <SheetClose asChild>
        <Button type="submit">Save changes</Button>
      </SheetClose>
    </SheetFooter>
  </SheetContent>
</Sheet>`,
		Variants: []string{"top", "right", "bottom", "left"},
	},
	"Toast": {
		Name:        "Toast",
		Description: "Toast notifications for success, error, or info messages using Sonner",
		Import: `import { toast } from "sonner"
import { Toaster } from "@/components/ui/sonner"`,
		Example: `// Add <Toaster /> to your layout once, then use toast() anywhere:
toast.success("Profile updated")
toast.error("Something went wrong")
toast("Event has been created", {
  description: "Monday, January 3rd at 6:00pm",
})`,
		Variants: []string{"success", "error", "info", "warning"},
	},
	"DropdownMenu": {
		Name:        "DropdownMenu",
		Description: "Accessible dropdown menu for actions, navigation, or context menus",
		Import:      `import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuRadioItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuGroup, DropdownMenuPortal, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuRadioGroup } from "@/components/ui/dropdown-menu"`,
		Example: `<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline">Open Menu</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent className="w-56">
    <DropdownMenuLabel>My Account</DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuGroup>
      <DropdownMenuItem>Profile</DropdownMenuItem>
      <DropdownMenuItem>Settings</DropdownMenuItem>
    </DropdownMenuGroup>
    <DropdownMenuSeparator />
    <DropdownMenuItem>Log out</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>`,
		Variants: []string{},
	},
}

// GetAllComponents returns a list of all available components with descriptions
func GetAllComponents() string {
	var sb strings.Builder
	sb.WriteString("Available shadcn/ui components:\n\n")

	for name, info := range ComponentRegistry {
		fmt.Fprintf(&sb, "• %s: %s\n", name, info.Description)
		if len(info.Variants) > 0 {
			fmt.Fprintf(&sb, "  Variants: %s\n", strings.Join(info.Variants, ", "))
		}
	}

	sb.WriteString("\nUse getComponentUsage with a component name to get import statement and usage example.")
	return sb.String()
}

// GetComponentInfo returns detailed info for a specific component
func GetComponentInfo(name string) (ComponentInfo, bool) {
	info, exists := ComponentRegistry[name]
	return info, exists
}

// GetComponentUsage returns formatted usage info for a component
func GetComponentUsage(name string) string {
	info, exists := ComponentRegistry[name]
	if !exists {
		return fmt.Sprintf("Component '%s' not found. Use listComponents to see available components.", name)
	}

	var sb strings.Builder
	fmt.Fprintf(&sb, "## %s\n\n", info.Name)
	fmt.Fprintf(&sb, "%s\n\n", info.Description)
	fmt.Fprintf(&sb, "### Import\n```tsx\n%s\n```\n\n", info.Import)

	if len(info.Variants) > 0 {
		fmt.Fprintf(&sb, "### Variants\n%s\n\n", strings.Join(info.Variants, ", "))
	}

	fmt.Fprintf(&sb, "### Example\n```tsx\n%s\n```", info.Example)

	return sb.String()
}
