type PlayerNameProps = {
  firstName: string;
  lastName?: string;
  short?: boolean;
};

export default function PlayerName({firstName, lastName, short = true}: PlayerNameProps) {
  const threshold = short ? 0 : 15;
  if (!lastName) {
    if (firstName.length > threshold) {
      return abbreviateFirstName(firstName);
    }
    return firstName;
  } else if (firstName.length + lastName.length > threshold) {
    const formattedLastName = abbreviateLastName(lastName);
    if (firstName.length + formattedLastName.length <= threshold) {
      return `${firstName} ${formattedLastName}`;

    }
    const formattedFirstName = abbreviateFirstName(firstName);
    return `${formattedFirstName} ${formattedLastName}`;
  } else {
    return `${firstName} ${lastName}`;
  }
}

function abbreviateFirstName(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 0) {
    return "";
  }
  if (parts.length === 1) {
    return name;
  }
  const firstWord = parts[0];
  const initials = parts.slice(1).map(word => word.charAt(0) + ".").join(" ");
  return `${firstWord} ${initials}`;
}

function abbreviateLastName(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0) + ".")
    .join(" ");
}
