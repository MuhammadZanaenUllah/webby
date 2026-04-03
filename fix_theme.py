import re

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    replacements = [
        ('bg-[#0a0a0a]', 'bg-background'),
        ('bg-[#111111]', 'bg-card'),
        ('bg-white/[0.01]', 'bg-foreground/5'),
        ('bg-white/[0.02]', 'bg-foreground/5'),
        ('bg-white/[0.04]', 'bg-foreground/10'),
        ('bg-white/[0.05]', 'bg-foreground/10'),
        ('border-white/5', 'border-primary/10'),
        ('border-white/10', 'border-primary/20'),
        ('text-white/5', 'text-foreground/20'),
        ('text-white/10', 'text-foreground/40'),
        ('text-white/20', 'text-foreground/40'),
        ('text-white/40', 'text-foreground/60'),
        ('text-white/50', 'text-foreground/60'),
        ('text-white/60', 'text-foreground/80'),
        ('text-white/80', 'text-foreground/90'),
        ('text-white/90', 'text-foreground'),
        ('bg-black/40', 'bg-background/80'),
        ('bg-white/5', 'bg-foreground/5'),
        ('bg-white/10', 'bg-foreground/10'),
        ('bg-white text-black hover:bg-primary hover:text-white', 'bg-foreground text-background hover:bg-primary hover:text-primary-foreground'),
        ('bg-destructive text-white', 'bg-destructive text-destructive-foreground'),
        ('text-white', 'text-foreground'),
        ('text-neutral-500', 'text-muted-foreground')
    ]

    for old, new in replacements:
        content = content.replace(old, new)

    with open(filepath, 'w') as f:
        f.write(content)

process_file('Install/resources/js/Pages/Projects/Index.tsx')
process_file('Install/resources/js/Pages/Admin/Projects/Index.tsx')
