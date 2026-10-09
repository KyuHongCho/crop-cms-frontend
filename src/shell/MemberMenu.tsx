import { ChevronDown, CircleUser } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useMember } from "../auth/MemberContext";
import { useTheme, type Theme } from "../theme/ThemeProvider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function MemberMenu() {
  const { logout } = useAuth();
  const { member } = useMember();
  const { theme, setTheme } = useTheme();
  const name = member ? member.display_name || member.email : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="max-w-40 sm:max-w-64">
          <CircleUser aria-hidden="true" className="size-5" />
          {name ? (
            <>
              <span className="sr-only">Account: </span>
              <span className="truncate">{name}</span>
            </>
          ) : (
            <span>Account</span>
          )}
          <ChevronDown aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64!">
        {member && (
          <>
            <DropdownMenuLabel className="text-sm! font-normal text-muted-foreground [overflow-wrap:anywhere]">
              {`Signed in as ${member.email}`}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuLabel className="text-sm!">Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as Theme)}>
          <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={logout}>Log out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
