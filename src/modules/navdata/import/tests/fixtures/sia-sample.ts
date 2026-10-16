// A hand-written extract in the layout of the SIA "XML SIA" export
// (SiaExport version 5). Positions of the aerodromes are real; the zones,
// navaid and their limits are FICTITIOUS test data shaped like the real
// ones (types, units, references, arcs as densified outlines): never use
// them for navigation.
export const SIA_SAMPLE_XML = `<?xml version="1.0" encoding="ISO-8859-1"?>
<SiaExport Version="5" Origine="SIA">
<Situation effDate="2026-10-29" ExtractionDate="2026-10-08">
<AdS>
<Ad pk="1001" lk="[LF][PN]"><Territoire pk="100" lk="[LF]"/><AdCode>PN</AdCode><AdStatut>CAP</AdStatut><ArpLat>48.751944</ArpLat><ArpLong>2.106111</ArpLong><AdRefAltFt>538</AdRefAltFt><AdNomComplet>TOUSSUS LE NOBLE</AdNomComplet><AdNomCarto>TOUSSUS</AdNomCarto></Ad>
<Ad pk="1002" lk="[LF][OP]"><Territoire pk="100" lk="[LF]"/><AdCode>OP</AdCode><AdStatut>CAP</AdStatut><ArpLat>49.384167</ArpLat><ArpLong>1.174722</ArpLong><AdRefAltFt>512</AdRefAltFt><AdNomComplet>ROUEN VALLÉE DE SEINE</AdNomComplet></Ad>
<Ad pk="1003" lk="[LF][PG]"><Territoire pk="100" lk="[LF]"/><AdCode>PG</AdCode><AdStatut>CAP</AdStatut><ArpLat>49.009722</ArpLat><ArpLong>2.547778</ArpLong><AdRefAltFt>392</AdRefAltFt><AdNomComplet>PARIS CHARLES DE GAULLE</AdNomComplet></Ad>
<Ad pk="1004" lk="[LF][PO]"><Territoire pk="100" lk="[LF]"/><AdCode>PO</AdCode><AdStatut>CAP</AdStatut><ArpLat>48.723333</ArpLat><ArpLong>2.379444</ArpLong><AdRefAltFt>291</AdRefAltFt><AdNomComplet>PARIS ORLY</AdNomComplet></Ad>
<Ad pk="1005" lk="[LF][BO]"><Territoire pk="100" lk="[LF]"/><AdCode>BO</AdCode><AdStatut>CAP</AdStatut><ArpLat>43.629444</ArpLat><ArpLong>1.363889</ArpLong><AdRefAltFt>499</AdRefAltFt><AdNomComplet>TOULOUSE BLAGNAC</AdNomComplet></Ad>
<Ad pk="1006" lk="[LF][MN]"><Territoire pk="100" lk="[LF]"/><AdCode>MN</AdCode><AdStatut>CAP</AdStatut><ArpLat>43.658333</ArpLat><ArpLong>7.215833</ArpLong><AdRefAltFt>12</AdRefAltFt><AdNomComplet>NICE CÔTE D'AZUR</AdNomComplet></Ad>
<Ad pk="1007" lk="[LF][RB]"><Territoire pk="100" lk="[LF]"/><AdCode>RB</AdCode><AdStatut>CAP</AdStatut><ArpLat>48.447778</ArpLat><ArpLong>-4.418611</ArpLong><AdRefAltFt>325</AdRefAltFt><AdNomComplet>BREST BRETAGNE</AdNomComplet></Ad>
</AdS>
<RwyS>
<Rwy pk="2001" lk="[LF][PN][07L/25R]"><Ad pk="1001" lk="[LF][PN]"/><Rwy>07L/25R</Rwy><Longueur>1100</Longueur><Largeur>30</Largeur><OrientationGeo>67</OrientationGeo><Revetement>Revêtue</Revetement><Principale>oui</Principale></Rwy>
<Rwy pk="2002" lk="[LF][OP][04/22]"><Ad pk="1002" lk="[LF][OP]"/><Rwy>04/22</Rwy><Longueur>1700</Longueur><Largeur>45</Largeur><OrientationGeo>42</OrientationGeo><Revetement>Revêtue</Revetement></Rwy>
</RwyS>
<ServiceS>
<Service pk="3001" lk="[LF][PN][TWR TOUSSUS Tour]"><Ad pk="1001" lk="[LF][PN]"/><Service>TWR</Service><IndicLieu>TOUSSUS</IndicLieu><IndicService>Tour</IndicService></Service>
<Service pk="3002" lk="[LF][OP][TWR ROUEN Tour]"><Ad pk="1002" lk="[LF][OP]"/><Service>TWR</Service><IndicLieu>ROUEN</IndicLieu><IndicService>Tour</IndicService></Service>
<Service pk="3101" lk="[LF][SIV TEST][FIS TEST Info]"><Espace pk="5100" lk="[LF][SIV TEST]"/><Service>FIS</Service><IndicLieu>TEST</IndicLieu><IndicService>Info</IndicService></Service>
<Service pk="3102" lk="[LF][CTR TOUSSUS][TWR TOUSSUS Tour]"><Espace pk="5001" lk="[LF][CTR TOUSSUS]"/><Service>TWR</Service><IndicLieu>TOUSSUS</IndicLieu><IndicService>Tour</IndicService></Service>
</ServiceS>
<FrequenceS>
<Frequence pk="4001" lk="[LF][PN][TWR][119.300]"><Service pk="3001" lk="[LF][PN][TWR TOUSSUS Tour]"/><Frequence>119.300</Frequence><HorCode>HX</HorCode></Frequence>
<Frequence pk="4002" lk="[LF][OP][TWR][118.900]"><Service pk="3002" lk="[LF][OP][TWR ROUEN Tour]"/><Frequence>118.900</Frequence></Frequence>
<Frequence pk="4101" lk="[LF][SIV][126.100]"><Service pk="3101" lk="[LF][SIV TEST][FIS TEST Info]"/><Frequence>126.100</Frequence></Frequence>
<Frequence pk="4102" lk="[LF][CTR][119.300]"><Service pk="3102" lk="[LF][CTR TOUSSUS][TWR TOUSSUS Tour]"/><Frequence>119.300</Frequence></Frequence>
</FrequenceS>
<NavFixS>
<NavFix pk="6001" lk="[LF][VOR-DME TST]"><Territoire pk="100" lk="[LF]"/><NavType>VOR-DME</NavType><Ident>TST</Ident><Latitude>49.050000</Latitude><Longitude>1.650000</Longitude></NavFix>
<NavFix pk="6002" lk="[LF][NDB TN]"><Territoire pk="100" lk="[LF]"/><NavType>NDB</NavType><Ident>TN</Ident><Latitude>48.800000</Latitude><Longitude>1.900000</Longitude></NavFix>
<NavFix pk="6003" lk="[LF][VFR PN-NW]"><Territoire pk="100" lk="[LF]"/><NavType>VFR</NavType><Ident>PN-NW</Ident><Latitude>48.830000</Latitude><Longitude>1.980000</Longitude><Description>Point de report obligatoire, échangeur autoroutier</Description></NavFix>
<NavFix pk="6004" lk="[LF][WPT ABCDE]"><Territoire pk="100" lk="[LF]"/><NavType>WPT</NavType><Ident>ABCDE</Ident><Latitude>48.900000</Latitude><Longitude>1.800000</Longitude></NavFix>
</NavFixS>
<RadioNavS>
<RadioNav pk="7001" lk="[LF][VOR-DME TST]"><NavFix pk="6001" lk="[LF][VOR-DME TST]"/><Station>TESTVILLE</Station><Frequence>113.900</Frequence><AltitudeFt>600</AltitudeFt></RadioNav>
<RadioNav pk="7002" lk="[LF][NDB TN]"><NavFix pk="6002" lk="[LF][NDB TN]"/><Station>TEST NORD</Station><Frequence>330</Frequence></RadioNav>
</RadioNavS>
<EspaceS>
<Espace pk="5001" lk="[LF][CTR TOUSSUS]"><Territoire pk="100" lk="[LF]"/><TypeEspace>CTR</TypeEspace><Nom>TOUSSUS</Nom><AdAssocie pk="1001" lk="[LF][PN]"/></Espace>
<Espace pk="5002" lk="[LF][TMA TEST]"><Territoire pk="100" lk="[LF]"/><TypeEspace>TMA</TypeEspace><Nom>TEST</Nom></Espace>
<Espace pk="5003" lk="[LF][P 99]"><Territoire pk="100" lk="[LF]"/><TypeEspace>P</TypeEspace><Nom>99</Nom></Espace>
<Espace pk="5004" lk="[LF][R 999]"><Territoire pk="100" lk="[LF]"/><TypeEspace>R</TypeEspace><Nom>999</Nom></Espace>
<Espace pk="5005" lk="[LF][D 998]"><Territoire pk="100" lk="[LF]"/><TypeEspace>D</TypeEspace><Nom>998</Nom></Espace>
<Espace pk="5100" lk="[LF][SIV TEST]"><Territoire pk="100" lk="[LF]"/><TypeEspace>SIV</TypeEspace><Nom>TEST</Nom></Espace>
<Espace pk="5200" lk="[LF][PRN 001]"><Territoire pk="100" lk="[LF]"/><TypeEspace>PRN</TypeEspace><Nom>001</Nom></Espace>
<Espace pk="5300" lk="[LF][AWY UN123]"><Territoire pk="100" lk="[LF]"/><TypeEspace>AWY</TypeEspace><Nom>UN123</Nom></Espace>
</EspaceS>
<PartieS>
<Partie pk="8001" lk="[LF][CTR TOUSSUS][.]"><Espace pk="5001" lk="[LF][CTR TOUSSUS]"/><NomPartie>.</NomPartie><NumeroPartie>1</NumeroPartie><Contour>1000001,Cloture=1,48.70 1.98,grc(48.70 1.98)</Contour><Geometrie>48.700000,1.980000
48.700000,2.220000
48.800000,2.220000
48.800000,1.980000
48.700000,1.980000</Geometrie></Partie>
<Partie pk="8002" lk="[LF][TMA TEST][1]"><Espace pk="5002" lk="[LF][TMA TEST]"/><NomPartie>1</NomPartie><NumeroPartie>1</NumeroPartie><Geometrie>48.650000,1.700000
48.650000,2.400000
49.100000,2.400000
49.100000,1.700000
48.650000,1.700000</Geometrie></Partie>
<Partie pk="8003" lk="[LF][P 99][.]"><Espace pk="5003" lk="[LF][P 99]"/><NomPartie>.</NomPartie><NumeroPartie>1</NumeroPartie><NomUsuel>CENTRALE TEST</NomUsuel><Contour>1000010,Cloture=2,49.20 1.30,cir(49.20 1.30:1.5:NM:0m:=)</Contour><Geometrie>49.200000,1.300000</Geometrie></Partie>
<Partie pk="8004" lk="[LF][R 999][.]"><Espace pk="5004" lk="[LF][R 999]"/><NomPartie>.</NomPartie><NumeroPartie>1</NumeroPartie><Geometrie>49.000000,1.500000
49.000000,1.700000
49.150000,1.700000
49.150000,1.500000
49.000000,1.500000</Geometrie></Partie>
<Partie pk="8005" lk="[LF][D 998][.]"><Espace pk="5005" lk="[LF][D 998]"/><NomPartie>.</NomPartie><NumeroPartie>1</NumeroPartie><Geometrie>49.250000,1.150000
49.250000,1.450000
49.320000,1.450000
49.320000,1.150000
49.250000,1.150000</Geometrie></Partie>
<Partie pk="8100" lk="[LF][SIV TEST][1]"><Espace pk="5100" lk="[LF][SIV TEST]"/><NomPartie>1</NomPartie><NumeroPartie>1</NumeroPartie><Geometrie>48.500000,0.800000
48.500000,2.600000
49.600000,2.600000
49.600000,0.800000
48.500000,0.800000</Geometrie></Partie>
<Partie pk="8200" lk="[LF][PRN 001][.]"><Espace pk="5200" lk="[LF][PRN 001]"/><NomPartie>.</NomPartie><NumeroPartie>1</NumeroPartie><NomUsuel>RÉSERVE NATURELLE TEST</NomUsuel><Geometrie>49.300000,1.250000
49.300000,1.350000
49.350000,1.350000
49.350000,1.250000
49.300000,1.250000</Geometrie></Partie>
<Partie pk="8300" lk="[LF][AWY UN123][.]"><Espace pk="5300" lk="[LF][AWY UN123]"/><NomPartie>.</NomPartie><NumeroPartie>1</NumeroPartie><Geometrie>48.000000,0.000000
48.000000,1.000000
48.100000,1.000000
48.000000,0.000000</Geometrie></Partie>
</PartieS>
<VolumeS>
<Volume pk="9001" lk="[LF][CTR TOUSSUS][.][1]"><Partie pk="8001" lk="[LF][CTR TOUSSUS][.]"/><Sequence>1</Sequence><PlafondRefUnite>ft AMSL</PlafondRefUnite><Plafond>1500</Plafond><PlancherRefUnite>SFC</PlancherRefUnite><Plancher>0</Plancher><Classe>D</Classe><HorCode>HX</HorCode><HorTxt>Voir AD 2 LFPN</HorTxt></Volume>
<Volume pk="9002" lk="[LF][TMA TEST][1][1]"><Partie pk="8002" lk="[LF][TMA TEST][1]"/><Sequence>1</Sequence><PlafondRefUnite>FL</PlafondRefUnite><Plafond>65</Plafond><PlancherRefUnite>ft AMSL</PlancherRefUnite><Plancher>1500</Plancher><Classe>D</Classe><HorCode>H24</HorCode></Volume>
<Volume pk="9003" lk="[LF][P 99][.][1]"><Partie pk="8003" lk="[LF][P 99][.]"/><Sequence>1</Sequence><PlafondRefUnite>ft AMSL</PlafondRefUnite><Plafond>3300</Plafond><PlancherRefUnite>SFC</PlancherRefUnite><Plancher>0</Plancher><HorCode>H24</HorCode><Activite>Interdiction de survol</Activite></Volume>
<Volume pk="9004" lk="[LF][R 999][.][1]"><Partie pk="8004" lk="[LF][R 999][.]"/><Sequence>1</Sequence><PlafondRefUnite>ft ASFC</PlafondRefUnite><Plafond>3000</Plafond><PlancherRefUnite>SFC</PlancherRefUnite><Plancher>0</Plancher><HorCode>NOTAM</HorCode><Remarque>Activité publiée par NOTAM#RTBA test</Remarque></Volume>
<Volume pk="9005" lk="[LF][D 998][.][1]"><Partie pk="8005" lk="[LF][D 998][.]"/><Sequence>1</Sequence><PlafondRefUnite>FL</PlafondRefUnite><Plafond>115</Plafond><PlancherRefUnite>ft AMSL</PlancherRefUnite><Plancher>2000</Plancher><HorCode>HX</HorCode><Activite>Tirs</Activite></Volume>
<Volume pk="9100" lk="[LF][SIV TEST][1][1]"><Partie pk="8100" lk="[LF][SIV TEST][1]"/><Sequence>1</Sequence><PlafondRefUnite>FL</PlafondRefUnite><Plafond>65</Plafond><PlancherRefUnite>SFC</PlancherRefUnite><Plancher>0</Plancher><Classe>G</Classe><HorCode>HX</HorCode></Volume>
<Volume pk="9200" lk="[LF][PRN 001][.][1]"><Partie pk="8200" lk="[LF][PRN 001][.]"/><Sequence>1</Sequence><PlafondRefUnite>ft ASFC</PlafondRefUnite><Plafond>1000</Plafond><PlancherRefUnite>SFC</PlancherRefUnite><Plancher>0</Plancher><HorCode>H24</HorCode><Activite>Survol / Overflight</Activite></Volume>
<Volume pk="9300" lk="[LF][AWY UN123][.][1]"><Partie pk="8300" lk="[LF][AWY UN123][.]"/><Sequence>1</Sequence><PlafondRefUnite>FL</PlafondRefUnite><Plafond>195</Plafond><PlancherRefUnite>FL</PlancherRefUnite><Plancher>115</Plancher></Volume>
</VolumeS>
</Situation>
</SiaExport>
`;

export const siaSampleBuffer = (): Buffer =>
  Buffer.from(SIA_SAMPLE_XML, 'latin1');
