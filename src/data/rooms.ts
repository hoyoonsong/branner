export type SpotKind = "room" | "lounge" | "amenity";

export type RoomSpot = {
  room: string;
  floor: 1 | 2 | 3;
  x: number;
  y: number;
  w: number;
  h: number;
  hall: string;
  kind: SpotKind;
  label?: string;
};

export type Rect = { x: number; y: number; w: number; h: number };

const TREATS = "Banana Treats";
const SAVANNAH = "Savannah Bananas";
const CARTOONS = "Banana Cartoons";
const REPUBLIC = "Banana Republic";

const HALL_BY_ROOM: Record<string, string> = {
  "100": "Lounge",
  "119": SAVANNAH,
  "121": SAVANNAH,
  "122": SAVANNAH,
  "123": SAVANNAH,
  "124": SAVANNAH,
  "125": SAVANNAH,
  "126": SAVANNAH,
  "127": SAVANNAH,
  "128": SAVANNAH,
  "130": SAVANNAH,
  "138": SAVANNAH,
  "140": SAVANNAH,
  "141": SAVANNAH,
  "142": SAVANNAH,
  "143": SAVANNAH,
  "147": SAVANNAH,
  "152": TREATS,
  "154": TREATS,
  "161": TREATS,
  "162": TREATS,
  "163": TREATS,
  "164": TREATS,
  "165": TREATS,
  "166": TREATS,
  "167": TREATS,
  "170": TREATS,
  "186": TREATS,
  "190": TREATS,
  "191": TREATS,
  "192": TREATS,
  "193": TREATS,
  "197": TREATS,
  "203": CARTOONS,
  "205": CARTOONS,
  "206": CARTOONS,
  "207": CARTOONS,
  "208": CARTOONS,
  "210": CARTOONS,
  "222": CARTOONS,
  "223": CARTOONS,
  "224": CARTOONS,
  "225": CARTOONS,
  "226": CARTOONS,
  "227": CARTOONS,
  "230": CARTOONS,
  "236": CARTOONS,
  "238": CARTOONS,
  "240": CARTOONS,
  "241": CARTOONS,
  "242": CARTOONS,
  "243": CARTOONS,
  "247": CARTOONS,
  "252": REPUBLIC,
  "262": REPUBLIC,
  "264": REPUBLIC,
  "265": REPUBLIC,
  "266": REPUBLIC,
  "270": REPUBLIC,
  "286": REPUBLIC,
  "290": REPUBLIC,
  "291": REPUBLIC,
  "292": REPUBLIC,
  "293": REPUBLIC,
  "297": REPUBLIC,
  "301": REPUBLIC,
  "303": REPUBLIC,
  "304": REPUBLIC,
  "307": REPUBLIC,
  "308": REPUBLIC,
  "309": REPUBLIC,
  "312": REPUBLIC,
};

const RW = 36;
const RH = 24;
const G = 3;
const HW = 14;
const P = RW + G;

function hallOf(room: string) {
  return HALL_BY_ROOM[room] ?? "";
}

function room(
  id: string,
  floor: 1 | 2 | 3,
  x: number,
  y: number,
  w = RW,
  h = RH,
): RoomSpot {
  return { room: id, floor, x, y, w, h, hall: hallOf(id), kind: "room" };
}

function amenity(
  id: string,
  floor: 1 | 2 | 3,
  x: number,
  y: number,
  label: string,
  w = RW,
  h = RH,
): RoomSpot {
  return { room: id, floor, x, y, w, h, hall: "", kind: "amenity", label };
}

function row(ids: string[], floor: 1 | 2 | 3, x: number, y: number): RoomSpot[] {
  return ids.map((id, i) => room(id, floor, x + i * P, y));
}

function col(ids: string[], floor: 1 | 2 | 3, x: number, y: number): RoomSpot[] {
  return ids.map((id, i) => room(id, floor, x, y + i * (RH + G)));
}

function buildFloor1(): { spots: RoomSpot[]; corridors: Rect[]; building: Rect[] } {
  const ox = 20;
  const northY = 18;
  const hallY = northY + RH + G;
  const southY = hallY + HW + G;
  const stemY = southY + RH + 6;

  const west = ["170", "166", "164", "162"] as const;
  const westAmen = [
    { id: "160", label: "Showers" },
    { id: "154", label: "154" },
    { id: "152", label: "152" },
  ];
  const spots: RoomSpot[] = [];

  spots.push(...row([...west], 1, ox, northY));
  westAmen.forEach((a, i) => {
    const x = ox + (west.length + i) * P;
    if (a.id === "160") spots.push(amenity(a.id, 1, x, northY, a.label));
    else spots.push(room(a.id, 1, x, northY));
  });

  const westW = (west.length + westAmen.length) * P - G;
  const loungeX = ox + westW + 8;
  const loungeW = 92;
  const loungeH = southY + RH - northY;
  spots.push({
    room: "100",
    floor: 1,
    x: loungeX,
    y: northY,
    w: loungeW,
    h: loungeH,
    hall: "Lounge",
    kind: "lounge",
    label: "Lounge",
  });

  const eastX = loungeX + loungeW + 8;
  spots.push(amenity("120", 1, eastX, northY, "Showers"));
  spots.push(...row(["122", "124", "126", "128", "130"], 1, eastX + P, northY));
  spots.push(...row(["167", "165", "163", "161"], 1, ox, southY));
  spots.push(...row(["119", "121", "123", "125", "127"], 1, eastX, southY));

  const leftHallX = ox + 4 * P + 4;
  const rightHallX = eastX + 8;
  spots.push(amenity("181", 1, leftHallX - P, stemY, "Showers"));
  spots.push(amenity("189", 1, leftHallX - P, stemY + RH + G, "Restroom"));
  spots.push(...col(["191", "193", "197"], 1, leftHallX - P, stemY + 2 * (RH + G)));
  spots.push(...col(["186", "190", "192"], 1, leftHallX + HW + G, stemY));
  spots.push(amenity("195", 1, leftHallX - P, stemY + 5 * (RH + G), "Stairs"));

  spots.push(...col(["138", "140", "142"], 1, rightHallX - P, stemY));
  spots.push(amenity("139", 1, rightHallX + HW + G, stemY, "Restroom"));
  spots.push(...col(["141", "143"], 1, rightHallX + HW + G, stemY + RH + G));
  spots.push(amenity("145", 1, rightHallX + HW + G, stemY + 3 * (RH + G), "Stairs"));
  spots.push(room("147", 1, rightHallX + HW + G, stemY + 4 * (RH + G)));

  const eastW = 6 * P - G;
  const stemH = 6 * (RH + G) - G;
  const corridors: Rect[] = [
    { x: ox - 4, y: hallY, w: westW + 8 + loungeW + 8 + eastW + 8, h: HW },
    { x: leftHallX, y: hallY, w: HW, h: stemY - hallY + stemH },
    { x: rightHallX, y: hallY, w: HW, h: stemY - hallY + stemH },
  ];
  const building: Rect[] = [
    { x: ox - 8, y: northY - 8, w: westW + 16, h: loungeH + 16 },
    { x: loungeX - 4, y: northY - 8, w: loungeW + 8, h: loungeH + 16 },
    { x: eastX - 8, y: northY - 8, w: eastW + 16, h: loungeH + 16 },
    { x: leftHallX - P - 8, y: stemY - 8, w: P + HW + P + 16, h: stemH + 16 },
    { x: rightHallX - P - 8, y: stemY - 8, w: P + HW + P + 16, h: stemH + 16 },
  ];
  return { spots, corridors, building };
}

function buildFloor2(): { spots: RoomSpot[]; corridors: Rect[]; building: Rect[] } {
  // Complete floor 2 from both plaques, rotated to π: bar on top, two legs down.
  // West bar 270→252 (Republic). East bar 206→230 (Cartoons).
  const ox = 16;
  const northY = 16;
  const hallY = northY + RH + G;
  const southY = hallY + HW + G;
  const stemY = southY + RH + 8;
  const spots: RoomSpot[] = [];

  const westN = ["270", "266", "264", "262"] as const;
  spots.push(...row([...westN], 2, ox, northY));
  spots.push(amenity("260", 2, ox + 4 * P, northY, "Showers"));
  spots.push(room("252", 2, ox + 5 * P, northY));
  spots.push(room("265", 2, ox + P, southY));
  spots.push(amenity("263", 2, ox + 2 * P, southY, "Restroom"));
  spots.push(room("261", 2, ox + 4 * P, southY));

  const stairsX = ox + 6 * P + 6;
  spots.push(amenity("200", 2, stairsX, northY, "Stairs"));
  const eastX = stairsX + P + 6;
  spots.push(...row(["206", "208", "210"], 2, eastX, northY));
  spots.push(amenity("220", 2, eastX + 3 * P, northY, "Showers"));
  spots.push(...row(["222", "224", "226", "230"], 2, eastX + 4 * P, northY));
  spots.push(...row(["203", "205", "207"], 2, eastX, southY));
  spots.push(amenity("209", 2, eastX + 3 * P, southY, "Study"));
  spots.push(amenity("221", 2, eastX + 4 * P, southY, "Restroom"));
  spots.push(...row(["223", "225", "227"], 2, eastX + 5 * P, southY));

  const leftHallX = ox + 4 * P + 4;
  spots.push(amenity("281", 2, leftHallX - P, stemY, "Showers"));
  spots.push(amenity("289", 2, leftHallX - P, stemY + RH + G, "Restroom"));
  spots.push(...col(["291", "293", "297"], 2, leftHallX - P, stemY + 2 * (RH + G)));
  spots.push(...col(["286", "290", "292"], 2, leftHallX + HW + G, stemY));

  const rightHallX = eastX + 3 * P + 4;
  spots.push(...col(["236", "238", "240", "242"], 2, rightHallX - P, stemY));
  spots.push(amenity("231", 2, rightHallX + HW + G, stemY, "Showers"));
  spots.push(amenity("239", 2, rightHallX + HW + G, stemY + RH + G, "Restroom"));
  spots.push(...col(["241", "243", "247"], 2, rightHallX + HW + G, stemY + 2 * (RH + G)));

  const westW = 6 * P - G;
  const eastW = 8 * P - G;
  const barW = stairsX + P + 6 + eastW - ox;
  const stemH = 5 * (RH + G) - G;
  const loungeH = southY + RH - northY;
  const corridors: Rect[] = [
    { x: ox - 4, y: hallY, w: barW + 8, h: HW },
    { x: leftHallX, y: hallY, w: HW, h: stemY - hallY + stemH },
    { x: rightHallX, y: hallY, w: HW, h: stemY - hallY + stemH },
  ];
  const building: Rect[] = [
    { x: ox - 8, y: northY - 8, w: westW + 16, h: loungeH + 16 },
    { x: stairsX - 6, y: northY - 8, w: P + 12, h: loungeH + 16 },
    { x: eastX - 8, y: northY - 8, w: eastW + 16, h: loungeH + 16 },
    { x: leftHallX - P - 8, y: stemY - 8, w: P + HW + P + 16, h: stemH + 16 },
    { x: rightHallX - P - 8, y: stemY - 8, w: P + HW + P + 16, h: stemH + 16 },
  ];
  return { spots, corridors, building };
}

function buildFloor3(): { spots: RoomSpot[]; corridors: Rect[]; building: Rect[] } {
  const ox = 24;
  const northY = 28;
  const hallY = northY + RH + G;
  const southY = hallY + HW + G;
  const spots: RoomSpot[] = [];
  spots.push(...row(["304", "308", "312"], 3, ox + P, northY));
  spots.push(amenity("317", 3, ox + 4 * P, northY, "Stairs"));
  spots.push(amenity("300", 3, ox, southY, "Stairs"));
  spots.push(...row(["301", "303", "307", "309"], 3, ox + P, southY));
  spots.push(amenity("315", 3, ox + 5 * P, southY, "Restroom"));

  const barW = 6 * P - G;
  const corridors: Rect[] = [{ x: ox - 4, y: hallY, w: barW + 8, h: HW }];
  const building: Rect[] = [
    { x: ox - 10, y: northY - 10, w: barW + 20, h: southY + RH - northY + 20 },
  ];
  return { spots, corridors, building };
}

const FLOORS = {
  1: buildFloor1(),
  2: buildFloor2(),
  3: buildFloor3(),
} as const;

export function spotsForFloor(floor: 1 | 2 | 3): RoomSpot[] {
  return FLOORS[floor].spots;
}

export function corridorsForFloor(floor: 1 | 2 | 3): Rect[] {
  return FLOORS[floor].corridors;
}

export function buildingForFloor(floor: 1 | 2 | 3): Rect[] {
  return FLOORS[floor].building;
}

export function allSpots(): RoomSpot[] {
  return [...FLOORS[1].spots, ...FLOORS[2].spots, ...FLOORS[3].spots];
}
