// Records (content unchanged, re-indented) of the real SIA export of AIRAC
// 2610 (export_xml_bd_sia_2026-10-01-v02.zip, Service de l'Information
// Aéronautique, Licence Ouverte), for the aerodrome sheet and the activity
// zones. OUT OF DATE after 2026-10-29: never use them for navigation.
//   XML SIA: aerodromes LFOP (A/A 120.200 HX "Absence ATS" and TWR 120.200
//   HO, ATIS), LFBO (its tower published on the CTR BLAGNAC only, ground as
//   "TWR BLAGNAC Sol") and LFMM (AdStatut OFF: a control centre); runway
//   05/23 of LFOP (grass, displaced thresholds, LDA 815 m); Pje 215
//   (parachuting), SUR 231 (low-level overflight ban), Aer 8430 (model
//   aircraft), all published as a point; the obstacle E4414-1.
//   AIXM 4.5: the directions 05 and 23 of LFOP (QFU 042.38) with the
//   declared distances of 05, and a take-off distance from the intersection
//   A3 of LFLY runway 16 (not the runway's).
export const SIA_2610_GAPS_XML = String.raw`<?xml version="1.0" encoding="ISO-8859-1"?>
<SiaExport Date="2026-08-21T10:25:54.385+02:00" Origine="Sia-France" Version="5">
    <Situation pubDate="2026-08-20" effDate="2026-10-01">
        <AdS>
            <Ad pk="89" lk="[LF][OP]">
                <Territoire pk="100" lk="[LF]"/>
                <AdCode>OP</AdCode>
                <AdAd2>oui</AdAd2>
                <AdStatut>CAP</AdStatut>
                <AdNomComplet>ROUEN VALLEE DE SEINE</AdNomComplet>
                <AdNomCarto>ROUEN</AdNomCarto>
                <AdSituation>10 KM de ROUEN.</AdSituation>
                <Wgs84>2</Wgs84>
                <ArpLat>49.390953</ArpLat>
                <ArpLong>1.183936</ArpLong>
                <ArpSituation>THR 22</ArpSituation>
                <AdRefAltFt>512</AdRefAltFt>
                <AdGeoUnd>145</AdGeoUnd>
                <AdRefTemp>21.9</AdRefTemp>
                <AdMagVar>1.44</AdMagVar>
                <MagVarDate>2025</MagVarDate>
                <TfcIntl>oui</TfcIntl>
                <TfcNtl>oui</TfcNtl>
                <TfcIfr>oui</TfcIfr>
                <TfcVfr>oui</TfcVfr>
                <TfcRegulier>oui</TfcRegulier>
                <TfcNonRegulier>oui</TfcNonRegulier>
                <TfcPrive>oui</TfcPrive>
                <AdGestion>SEARVS</AdGestion>
                <AdAdresse>Aéroport de Rouen - Rue Maryse Bastié - BP87 - 76520 BOOS</AdAdresse>
                <AdTel>Direction : 02 35 79 41 02#Standard : 02 35 79 41 00#Opérations : 02 35 79 41 01</AdTel>
                <AdAfs>LFOPYDYX, LFOPXHAX</AdAfs>
                <AdRem>SITA : UROAPXH#SEARVS (Société d'Exploitation Aéroportuaire de Rouen Vallée de Seine)</AdRem>
                <HorAdminCode>HX</HorAdminCode>
                <HorBiaTxt>BORDEAUX.</HorBiaTxt>
                <HorMetTxt>0300-0000</HorMetTxt>
                <HorAvtTxt>HOR AVT : LUN - VEN : 0745 - 1630, SAM - DIM : 0845 - 1730.#Extension et réouverture : O/R, pendant heures ouvrables :#TEL : 02 35 79 41 01 ou SITA : UROAPXH ou RSFTA : LFOPXHAX#En dehors des heures ouvrables, pour aéronefs d'Etat ou EVASAN seulement : TEL : 06 74 69 57 69.\\
AVT SKED: MON - FRI : 0745 - 1630, SAT - SUN : 0845 - 1730.#Extension and reopening : O/R, during working hours :#TEL : 02 35 79 41 01 or SITA : UROAPXH or RSFTA : LFOPXHAX#Outside working hours, for State ACFT or Air ambulance only : TEL : 06 74 69 57 69.</HorAvtTxt>
                <HorManutentionTxt>LUN - VEN : 0745 - 1630, SAM - DIM : 0845 - 1730.#Extension et réouverture : O/R, pendant heures ouvrables :#TEL : 02 35 79 41 01 ou SITA : UROAPXH ou RSFTA : LFOPXHAX#En dehors des heures ouvrables : TEL : 06 74 69 57 69.\\
MON - FRI : 0745 - 1630, SAT - SUN : 0845 - 1730.#Extension and reopening : O/R, during working hours :#TEL : 02 35 79 41 01 or SITA : UROAPXH or RSFTA : LFOPXHAX#Outside working hours : TEL : 06 74 69 57 69.</HorManutentionTxt>
                <HorSureteTxt>HOR : voir Gestionnaire AD\\SKED : see AD administration</HorSureteTxt>
                <HorDegivrageTxt>HOR : voir HANDLING.\\SKED : see HANDLING</HorDegivrageTxt>
                <HorAdminTxt>LUN - VEN : 0700 - 1700, SAM et DIM : 0800 - 1800.#Extension et réouverture O/R :#- pendant heures ouvrables : TEL 02 35 79 41 01#- en dehors des heures ouvrables : TEL 06 74 69 57 69.\\
MON - FRI : 0700 - 1700, SAT and SUN : 0800 - 1800.#Extension and reopening O/R :#- during working hours : TEL 02 35 79 41 01#- outside working hours : TEL 06 74 69 57 69.</HorAdminTxt>
                <SvcEscaleFret>O/R. HOR : voir HANDLING.\\O/R. HOR : see HANDLING.</SvcEscaleFret>
                <SvcEscaleFuel>Carburants/Fuel types: 100LL - JET A1 (CIV-MIL) - Lubrifiants/Lubricants : ETO 2380-R3520 (CIV-MIL).</SvcEscaleFuel>
                <SvcEscaleFuelRem>100LL : 2 cuves de 20000 l#JET A1 : 2 cuves de 50000 l + 1 camion de 20000 l.</SvcEscaleFuelRem>
                <SvcEscaleDegivrage>NIL\\NIL</SvcEscaleDegivrage>
                <SvcEscaleHangar>2000 m2 - hauteur des portes : 9 m et 5.50 m - non chauffés.\\2000 m2 - doors height: 9 m and 5.50 m - non heated.</SvcEscaleHangar>
                <SvcEscaleReparation>NIL\\NIL</SvcEscaleReparation>
                <SvcEscaleRem>NIL\\NIL</SvcEscaleRem>
                <SvcPaxHotel>Nombreux hôtels à ROUEN et à proximité.\\Many hotels in ROUEN and nearby.</SvcPaxHotel>
                <SvcPaxResto>Sur l'aéroport et à  proximité. Catering et restaurant sur AD.\\At airport and nearby. Catering and restaurant at AD.</SvcPaxResto>
                <SvcPaxTransport>Taxis, voitures de louage,TEL HANDLING:02 35 79 41 00 ou 03.\\Taxis, car rental.TEL HANDLING:02 35 79 41 00 ou 03</SvcPaxTransport>
                <SvcPaxBanque>A 1 km dans la ville de Boos.\\1 km away, in Boos town.</SvcPaxBanque>
                <SvcPaxTourisme>Office du Tourisme de Rouen#25 place de la Cathédrale#BP 666-76008, Rouen Normandie cedex 1#TEL : 02 32 08 32 40 - FAX : 02 32 08 32 44.</SvcPaxTourisme>
                <SvcPaxSan>Trousse premier secours et oxygènothérapie. Hôpitaux et cliniques en ville.#Cabinet médical : 02 35 80 20 80.#Défibrillateur.\\First aid kit and oxygenotherapy. Public and private hospitals in ROUEN.#Medical office : 02 35 80 20 80.#Defibrillator.</SvcPaxSan>
                <SsliaCat>5</SsliaCat>
                <SsliaFac>Niveau 5 :#LUN - VEN : 0700 - 1700, SAM - DIM : 0800 - 1800#Extension et réouverture O/R :#Pendant heures ouvrables :#TEL : 02 35 79 41 01#En dehors des heures ouvrables :#TEL : 06 74 69 57 69#Niveau 1 : en dehors de ces horaires.\\
Level 5 :#MON - FRI : 0700 - 1700, SAT - SUN : 0800 - 1800#Extension and reopening O/R :#During working hours :#TEL : 02 35 79 41 01#Outside working hours :#TEL : 06 74 69 57 69#Level 1 : outside these SKED.</SsliaFac>
                <SsliaAcft>Voir Gestionnaire AD\\See AD administration</SsliaAcft>
                <SsliaRem>Niveau 1 pour piste non revêtue 05/23</SsliaRem>
                <NeigePriorite>- Piste sur une largeur de 30 m au moins et sur la totalité de la longueur ainsi que les raquettes d'extrémité et les balisages associés.#- TWY 22.#- Parking B.#- Parking M et TWY associés.#- Totalité de la piste#- Autres TWY#- Parkings A et C.\\- RWY over a width of at least 30 m and its entire length in addition to the turn-around areas and the associated lighting.#- TWY 22.#- B apron.#- M apron and associated TWY.#- The entire RWY.#- The other TWY.#- A and C aprons.</NeigePriorite>
                <NeigeEqpt>- Lame de caoutchouc de déneigement d'une largeur de 2.50 m, mise en oeuvre sur un véhicule par le SSIS local.#- 2 camions équipés de lame biaise d'une largeur de 2.50 m mis en oeuvre par une entreprise locale.#- Déverglaçant ECO 6, D-VER-ICE clearway, épandage par une entreprise locale.\\ Rubber snow clearance blade over a width of 2.50 m mounted on a local fire service vehicle.#- 2 trucks equipped with skew blades 2.50 m wide operated by a local firm.#- ECO 6, D-VER-ICE clearway de-icing agent applied by a local firm.</NeigeEqpt>
                <NeigeRem>Evaluation et report de l'état de surface des pistes #conformément à la méthode "Global Reporting Format" #(GRF) décrite en AD 1.2.2#Les horaires GRF sont publiés en AD 2.3#Les opérations sont conduites de manière à réduire au maximum la durée de fermeture de la plate-forme au trafic aérien. Dans tous les cas, les décisions d'interventions et l'ordre des opérations sont fonction du trafic commercial attendu, des conditions d'exploitation et de l'évolution des conditions météorologiques.#Durée moyenne des opérations :#- Aire de manoeuvre :#. Déneigement par lame biaise : 2 heures.#. Epandage de déverglaçant : 1 heure 30 minutes.#- Parkings avions :#. Déneigement : 1 heure.#. Epandage de déverglaçant : 30 minutes.\\Assessment and reporting of runway surface condition #in accordance with the Global Reporting Format #(GRF) described in AD 1.2.2#GRF operational hours are published in AD 2.3#Operations will be carried out in such a way as to reduce time that the airfield is closed to air traffic to a minimum. In all cases, the decisions as to when action is to be taken and the order in whitch the operations are carried out will depend on the anticipated commercial traffic, operating conditions and changes in meteorological conditions.#Average time taken for the operations:#- Manoeuvring area:#. Snow clearance by skew blade: 2 hours.#. Spreading of de-icing agent: 1 hour 30 minutes.#- ACFT parking areas:#. Snow clearance: 1 hour.#. Spreading of de-icing agent: 30 minutes.</NeigeRem>
                <AireTfcRevet>Enrobé</AireTfcRevet>
                <AireTfcResist>Parking B : 45 F/A/W/T\\B apron : 45 F/A/W/T</AireTfcResist>
                <TwyLargeur>15m.</TwyLargeur>
                <TwyRevet>Enrobé</TwyRevet>
                <TwyResist>TWY T1 et S1 :  45 F/A/W/T#TWY P, T2 et T3 : 24 F/B/W/T#TWY S, S2, S3, R1, R2 : 20 F/B/W/T\\TWY T1 and S1 :  45 F/A/W/T#TWY P, T2 and T3 : 24 F/B/W/T#TWY S, S2, S3, R1, R2 : 20 F/B/W/T</TwyResist>
                <AireAclLoc>Seuil RWY22\\THR RWY 22</AireAclLoc>
                <AireAclAltFt>Seuil RWY 22 : 512\\THR RWY 22: 512</AireAclAltFt>
                <PkgId>Voir/see AD 2 LFOP APDC 01</PkgId>
                <GuidTwy>Oui\\Yes</GuidTwy>
                <GuidRwy>RWY 04/22 : ligne axiale, n° d'identifications, marques de seuils, de point d'impact et  de zone de toucher des roues.#Bande gazonnée 05/23 : balisage latéral, balisage d'angles et DTHR.\\RWY 04/22 : centre line, designations, THR, impact point and TDZ markings.#Grass strip 05/23 : edge marking, corners markings and DTHR.</GuidRwy>
                <GuidStopBars>Feux de protection de piste sur bretelles T1, T2 et T3.\\RWY protection lights on TWY T1, T2 and T3.</GuidStopBars>
                <MetCentre>LILLE</MetCentre>
                <MetAltnCentre>BALE</MetAltnCentre>
                <MetTafCentre>LILLE</MetTafCentre>
                <MetTafValidite>9#06-09-12-15#CNL 18 ETE#CNL 19 HIVER</MetTafValidite>
                <MetPreviAtt>TREND</MetPreviAtt>
                <MetPreviPeriode>HIV/WIN : 0600-1900#ETE/SUM : 0600-1800</MetPreviPeriode>
                <MetBriefing>T</MetBriefing>
                <MetDoc>C - PL</MetDoc>
                <MetLangue>FR</MetLangue>
                <MetCartes>METAR AUTO</MetCartes>
                <MetComplement>NIL</MetComplement>
                <MetAts>TWR</MetAts>
                <MetRem>TEL MET (IFR) : 03 62 72 52 25.</MetRem>
                <LgtTwyAxial>G seulement pour raquette de demi-tour en QFU 22.\\G only for QFU 22 turn around area.</LgtTwyAxial>
                <LgtTwyLateral>Oui</LgtTwyLateral>
                <SecoursAlim>Groupe électrogène\\Power unit.</SecoursAlim>
                <SecoursDelai>Inférieur à 1 seconde.\\Less than 1 second.</SecoursDelai>
                <LgtRem>PCL hors HOR ATS.\\PCL out of ATS SKED.</LgtRem>
                <Geometrie>49.390953,1.183936</Geometrie>
            </Ad>
            <Ad pk="100" lk="[LF][BO]">
                <Territoire pk="100" lk="[LF]"/>
                <AdCode>BO</AdCode>
                <AdAd2>oui</AdAd2>
                <AdStatut>CAP</AdStatut>
                <AdNomComplet>TOULOUSE BLAGNAC</AdNomComplet>
                <AdNomCarto>T. BLAGNAC</AdNomCarto>
                <AdSituation>3,6 NM WNW de TOULOUSE.\\
3.6 NM WNW from TOULOUSE.</AdSituation>
                <Wgs84>2</Wgs84>
                <ArpLat>43.635128</ArpLat>
                <ArpLong>1.367856</ArpLong>
                <ArpSituation>Tour.\\Tower.</ArpSituation>
                <AdRefAltFt>499</AdRefAltFt>
                <AdGeoUnd>160</AdGeoUnd>
                <AdRefTemp>27</AdRefTemp>
                <AdMagVar>1.66</AdMagVar>
                <MagVarDate>2025</MagVarDate>
                <TfcIntl>oui</TfcIntl>
                <TfcNtl>oui</TfcNtl>
                <TfcIfr>oui</TfcIfr>
                <TfcVfr>oui</TfcVfr>
                <TfcRegulier>oui</TfcRegulier>
                <TfcNonRegulier>oui</TfcNonRegulier>
                <TfcPrive>oui</TfcPrive>
                <AdGestion>ATB</AdGestion>
                <AdAdresse>BP 103 31703 BLAGNAC</AdAdresse>
                <AdTel>0 825 380 000</AdTel>
                <AdTelex>TLSAPXH et TLSCHXH</AdTelex>
                <AdAfs>LFBOYDYX</AdAfs>
                <AdRem>ATB : Aéroport Toulouse-Blagnac</AdRem>
                <HorSanTxt>H24</HorSanTxt>
                <HorBiaTxt>BORDEAUX (voir / see GEN)</HorBiaTxt>
                <HorMetTxt>H24</HorMetTxt>
                <HorAvtTxt>SASCA#
Horaires : H24# 
Paiement : cartes TOTAL et BP.#Pour un paiement comptant hors contrat, suivre procédure suivante :#
 - TOTAL : les avitaillements doivent systématiquement faire l'objet d'un accord de la part de la direction commerciale d'AIR TOTAL.#
 - BP : l'avitaillement ne peut se faire qu'après vérification que le client ne figure pas sur la "liste noire" BP.#
WORLD FUEL SERVICES :#
Horaires : 0400-2200 7/7. En dehors de ces horaires sur demande avec préavis 45 min.#
Paiement : AVCARD, Carte WFS, UVAIR, COLT.#
TEL : 06 59 75 11 77#
\\

SASCA#
Hours : H24#
Payment : TOTAL and BP cards.#For out-of-contract cash payment follow the following procedure :#
 - TOTAL : refueling must be systematically approved by AIR TOTAL commercial management.#
 - BP : refueling can only be done after verification that the customer is not on the BP "blacklist".#
WORLD FUEL SERVICES :#
Hours :  0400-2200 7/7. Outside these SKED : on request 45 min before.#
Payment : AVCARD, WFS card, UVAIR, COLT.#
TEL : 06 59 75 11 77</HorAvtTxt>
                <HorManutentionTxt>Non disponible.\\Not available.</HorManutentionTxt>
                <HorSureteTxt>Horaire du contrôle de sûreté sur l'aérogare d'aviation générale :#
LUN-VEN : 1230-1630#
En dehors de ces horaires toute demande sera traitée entre le demandeur autre qu'ATB et l'opérateur de sureté et facturée au demandeur.#
\\
Security control SKED on general aviation terminal:#
MON-FRI: 1230-1630#
Outside these SKED, all request will be handled between the applicant other than ATB and the security operator and will be charged to the applicant.</HorSureteTxt>
                <HorDegivrageTxt>Assuré\\Provided</HorDegivrageTxt>
                <HorRem>Pour plus d'informations contacter le Chef d'Escale de Permanence ATB : 05 61 42 45 05 / E-mail : cep@toulouse.aeroport.fr#GRF (Service d'évaluation et de report de l'état de surface de piste) : 0400-2100, astreinte en dehors de ces horaires : 7/7.\\For more information contact stopover chief : 05 61 42 45 05 / E-mail : cep@toulouse.aeroport.fr#GRF (RWY surface condition assessment and report service) : 0400-2100, on-call outside these hours : 7/7.</HorRem>
                <HorAdminTxt>H24</HorAdminTxt>
                <HorCustTxt>H24</HorCustTxt>
                <HorAtsTxt>H24</HorAtsTxt>
                <SvcEscaleFret>Gare SNCF à Toulouse, gare de fret.\\
Railway station in Toulouse, freight station.</SvcEscaleFret>
                <SvcEscaleFuel>Carburants/Fuel : JET A1#
Lubrifiants/Lubricants : Aero 80-80D-100-100D. Aero DM.</SvcEscaleFuel>
                <SvcEscaleFuelRem>Camions avitailleurs/Fueling trucks#JET A1 : 2000 m3.</SvcEscaleFuelRem>
                <SvcEscaleDegivrage>4 véhicules de dégivrage/antigivrage (FMC/SDMI).#Produits de dégivrage/antigivrage : ABAX ECOWING 26, ABAX DE 950 (agents de surface non-ioniques), ABAX ECOWING AD 49 (propane -1,2-diol), ABAX SAFEGRIP FR (formiate de potassium).\\4 de-icing/anti-icing vehicles (FMC/SDMI).#De-icing/anti-icing products : ABAX ECOWING 26, ABAX DE 950 (non-ionic surface agents), ABAX ECOWING AD 49 (propane-1,2-diol), ABAX SAFEGRIP FR (kalium formiat).</SvcEscaleDegivrage>
                <SvcEscaleHangar>Aerotec, hangar H27 chauffé : 2400 m2, 4 portes coulissantes de 10 x 8.5 m.\\
Aerotec, hangar H27 heated : 2400 m2, 4 sliding doors 10 x 8.5 m.</SvcEscaleHangar>
                <SvcEscaleReparation>Aerotec 05 61 16 73 73 - FAX 05 61 30 05 49. Station service et labo radio agréés. Petites réparations électricité, hydraulique et mécanique.\\
Aerotec 05 61 16 73 73 - FAX 05 61 30 05 49. Service station and radio repair-shop agreed. Minor repairs electricity, hydraulic and mechanical.</SvcEscaleReparation>
                <SvcEscaleRem>Dans le cas d'un recours à un service entrant dans la nomenclature des opérations d'assistance, il y a obligation de recourir à un assistant ayant l'agrément requis.#
Oxygène et services connexes : O/R Uni Air Entreprise (oxygène et azote).\\
If a service part of handling operations nomenclature is needed, request for an approved handling operator becomes mandatory.#
Oxygen and related services: O/R Uni Air Entreprise (oxygen and nitrogen).</SvcEscaleRem>
                <SvcPaxHotel>Un hôtel sur et à proximité de l'aéroport.\\A hotel at and near the airport.</SvcPaxHotel>
                <SvcPaxResto>Sur l'aéroport (restaurants et snacks).\\At the airport (restaurants and snack bars).</SvcPaxResto>
                <SvcPaxTransport>Navettes ville, taxis.\\Town shuttle, taxis.</SvcPaxTransport>
                <SvcPaxBanque>Boîte aux lettres: niveau arrivées hall B et niveau départs hall C, salle d'embarquement hall D#Distributeurs de billets et services bancaires.#\\

Mailbox: at arrival floor hall B and at departure hall C, boarding room hall D#Cash dispenser and bank services available.</SvcPaxBanque>
                <SvcPaxSan>Agents SSIAP. Poste de premier secours sur l'AD.#Hôpital à 1.5 km.\\SSIAP agents. Fisrt aid room at AD.#Hospital 1.5 km away.</SvcPaxSan>
                <SsliaCat>9</SsliaCat>
                <SsliaFac>Moyens de secours aéronautiques :#1 VIM 110 (Véhicule Intervention Mousse) muni de 12000 L d'eau, 250 kg de poudre.#1 VIM 110 muni de 10700 L d'eau, 250 kg de poudre.#1 VIM 90 muni de 9150 L d'eau, 250 kg de poudre.\\Aeronautical rescue equipment :#1 VIM 110 (foam intervention vehicle) equipped with 12000L of water, 250 kg of powder.#1 VIM 110 equipped with 10700 L of water, 250 kg of powder.#1 VIM 90 equipped with 9150 L of water, 250 kg of powder.</SsliaFac>
                <SsliaAcft>Procédure gestionnaire AD\\AD operator procedure</SsliaAcft>
                <SsliaRem>Modulation au niveau 7 suivant horaire (voir NOTAM).#
Demande de niveau 9 possible avec PPR PN 7 jours au +33.(0)5.61.42.45.05</SsliaRem>
                <NeigePriorite>- La piste 14R/32L dégagée sur une largeur de 30m et sur toute la longueur.#
- Les voies de circulation reliant la piste 14R/32L aux aires de stationnement sont traitées immédiatement après la piste (les lignes de guidages au sol sont conservées visibles au fur et à mesure des chûtes de neige).#
- Les voies de circulation restantes, ainsi que la bretelle conduisant au parking Aérospatiale et CEV. #
- L'ordre des opérations décrites peut varier en fonction du trafic attendu,des conditions d'exploitation et des conditions météorologiques.\\
RWY 14R/32L over a width of 30m and all the length.#
- The TWY connecting the RWY 14R/32L with the parking area will be cleared immediately after the RWY (the ground guidance marking will be cleared as the snowfalls go along).#
- The remaining TWY and the strip leading to the Aérospatiale parking area and to the CEV (flying test center).#
- The order in which the operations described above are carried out may vary depending on the anticipated traffic, operating conditions and meteorological conditions.</NeigePriorite>
                <NeigeEqpt>Moyens internes :#3 tracteurs équipés de 3 lames.#1 mini tracteur + lame (utilisation sur les aires de trafic).#2 cuves d'épandage trainées de 3600 litres.#60 000 litres de déverglaçant liquide (pour l' aire de mouvement).#1 véhicule de déneigement des allées de parkings auto (côté public).#Plusieurs équipements manuels de salage (côté public).#Moyens externes supplémentaires :#Soit 2 niveleuses équipées en continu.#Soit 3 niveleuses avec lames caoutchoutées pendant 8h.#1 véhicule poids lourd de déneigement et de salage pour la voie publique.#Le déverglaçage de l'aire de mouvement est réalisé suivant les priorités de dégagement, en action curative uniquement.#Type de produit déverglaçant pour les pistes : CLEARWAY F1 (formiate de potassium).#
Provifrost KF ECO (formiate de potassium).

\\Internal materials :#3 tractors equipped with 3 skew blades.#1 mini tractor + 1 skew blade (use on apron).#2 mobile 3600 litres spreading tanks.#60 000 litres of deicing fluid (for movement area).#1 snow removal vehicle  for drives of car parks (public side).#Several manual salting equipments (public side).#Additional external materials :#Either 2 permanently equipped levellers. #Or 3 levellers with rubber blades during 8 hours.#1 truck for snow removal and salting for public way.#Deicing of the movement area is carried out according to clearance priority, as a curative action only.#De-icing product for runway : CLEARWAY F1 (kalium formiat).#
Provifrost KF ECO (kalium formiat).</NeigeEqpt>
                <NeigeRem>Evaluation et report de l'état de surface des pistes #conformément à la méthode "Global Reporting Format" #(GRF) décrite en AD 1.2.2#Les horaires GRF sont publiés en AD 2.3#Les phénomènes d'une durée prévisible supérieure à 6 heures font l'objet d'une diffusion par NOTAM NEIGE. Si la durée prévisible est inférieure à 6 heures, un avis d'enneigement est envoyé aux cinq ACC en FRANCE pour diffusion aux aéronefs en vol.\\Assessment and reporting of runway surface condition #in accordance with the Global Reporting Format #(GRF) described in AD 1.2.2#GRF operational hours are published in AD 2.3#
Snow conditions likely to last longer than 6 hours will be the subject of a SNOWTAM. If the anticipated time is less than 6 hours, a snowfall or ice warning will be sent to the 5 french ACC for transmission to ACFT in flight.</NeigeRem>
                <AireTfcRevet>Béton bitumineux ou béton.\\Bituminous concrete or concrete.</AireTfcRevet>
                <AireTfcResist>Non disponible\\Not available</AireTfcResist>
                <TwyLargeur>TWY M2, M4, M8, M10, M11, N1, N2, N4, N6, N8, P10, P20, P40, P50, P55, P60, P65, P70, P90, P100, P101, S2, S3, S4, S6, S8, S10, S11,T40, T50, T55, T60, T100, T101,W20, W30, W35, W40, W50, W60, W80, W90, W100 : 25 m.# TWY T21, T22, T41, T51, T61, T65, T71, T81 : 23 m.#
TWY T10, T11, T12 : 22.5 m.#
TWY T20, T42, T43, T44 : 18 m.</TwyLargeur>
                <TwyRevet>Toutes les voies de circulation en béton bitumineux, sauf les voies M8, S2, S4, W60, W80, W90 et W100 en béton.\\All TWY in bituminous concrete, except TWY M8, S2, S4, W60, W80, W90 and W100 in concrete.</TwyRevet>
                <TwyResist>M4 : 54 F/C/W/T#
N8 : 60 F/B/W/T #
S4, S2 : 63 R/C/W/T#
N6 : 54/F/B/W/T#
N4, T40, T41 : 61/F/A/W/T#
M8 : 60 F/C/W/U#
P10 : 51 F/C/W/T#
P40, N2, P20, P50, P55, P60, P65, P70, T50, T51 : 61 F/B/W/T#
T55, T60, T65 : 60 F/C/W/T#
S3, M2 : 63F/C/W/T#
S6 : 64 F/C/W/T#
S8, S10 : 69 F/B/W/T#
W30, W35, W40, W50, S11, M11, P100, P101, T100, T101 : 53 F/C/W/U#
W20 : 53 F/C/W/T#
W60, W80, W90, W100 : 61 R/B/W/T</TwyResist>
                <AireAclLoc>Aire passagers et aire de fret.#
Roulette de nez sur TWY T50 (43°37'44.10''N - 001°22'18.25''E).\\
Passengers' and freight areas.#
Nose wheel on TWY T50 (43°37'44.10''N - 001°22'18.25''E).</AireAclLoc>
                <AireAclAltFt>ALT moyenne aire passagers / aire de fret : 488 ft.#
ALT roulette de nez sur TWY T50 : 487 ft.\\
Passengers' and freight areas mean ALT : 488 ft.#
Nose wheel ALT on TWY T50 : 487 ft.</AireAclAltFt>
                <PkgId>Voir/See IAC TOULOUSE BLAGNAC APDC</PkgId>
                <GuidTwy>Oui\\Yes</GuidTwy>
                <GuidAccost>Aucun dispositif de guidage, placeur obligatoire sur tous les postes de stationnement.\\No type guidance system, mandatory marshallers on all ACFT PKG stands.</GuidAccost>
                <GuidRwy>OACI\\ICAO</GuidRwy>
                <GuidStopBars>Permanentes: TWY S3, S4, S6, S8, S10, M10, M8, M4, M2, ATE#Commandables: TWY M11, S2, W100#Voir carte AD2 - LFBO - OACI\\Permanent: TWY S3, S4, S6, S8, S10, M10, M8, M4, M2, ATE#Controlled: TWY M11, S2, W100#See chart AD2 - LFBO - OACI</GuidStopBars>
                <GuidRem>TWY P101 : bande dégagée réduite à 84 m.\\TWY P101 : Clear strip limited to 84 m.</GuidRem>
                <MetCentre>CRA-TOULOUSE</MetCentre>
                <MetTafCentre>CRA-TOULOUSE</MetTafCentre>
                <MetTafValidite>30#06-12-18-24</MetTafValidite>
                <MetPreviAtt>TREND</MetPreviAtt>
                <MetPreviPeriode>H24</MetPreviPeriode>
                <MetBriefing>P - T - D</MetBriefing>
                <MetDoc>C - PL</MetDoc>
                <MetLangue>FR</MetLangue>
                <MetCartes>AD WARNING#
METAR AUTO</MetCartes>
                <MetComplement>AEROWEB PRO</MetComplement>
                <MetAts>TWR</MetAts>
                <MetRem>TEL MET (IFR) : 05 61 16 43 12.</MetRem>
                <LgtTwyAxial>TWY M2, M11, N2, P20, P40, P50, P55, P60, P65, P70, P90, P100, P101, S11, S60, S90, T40, T41, T50, T51, T55, T60, T65, T100, W60, W80, W90, W100.</LgtTwyAxial>
                <LgtTwyLateral>TWY W20, W30,W35, W40, W50, W60, W80, W90, W100, S2, S3, S4, S6, S8, S10, S11, M2, M4, M8, M10, M11, N1, N2, N4, N6, N8, P10, P20, P40, P50, P55, P60, P65, P70, P90, P100, P101, T10, T40, T50, T55, T60, T65, T100, T101.</LgtTwyLateral>
                <SecoursAlim>1 alimentation ENEDIS et 2 alimentations secours ENEDIS et groupe électrogène conformes aux approches de précision.\\1 ENEDIS power-unit and 2 ENEDIS emergency power-units and electricity generator in compliance with precision approach.</SecoursAlim>
                <SecoursDelai>1 s</SecoursDelai>
                <LgtRem>Balisage latéral rétroréfléchissant vers parkings CEV et DSNA. Balisage axial de P90 vers T100 codé orange et vert.\\Reflective marking edges towards parking CEV and DSNA. Centre line lighting P90 to T100 coded orange and green.</LgtRem>
                <Geometrie>43.635128,1.367856</Geometrie>
            </Ad>
            <Ad pk="30105" lk="[LF][MM]">
                <Territoire pk="100" lk="[LF]"/>
                <AdCode>MM</AdCode>
                <AdAd2>non</AdAd2>
                <AdStatut>OFF</AdStatut>
                <AdNomComplet>AIX EN PROVENCE (MARSEILLE)</AdNomComplet>
                <AdNomCarto>AIX EN PROVENCE (MARSEILLE)</AdNomCarto>
                <Wgs84>2</Wgs84>
                <ArpLat>44.989722</ArpLat>
                <ArpLong>-8.539722</ArpLong>
                <ArpSituation>Fictive airport only used for AFS</ArpSituation>
                <AdRefAltFt>0</AdRefAltFt>
                <AdGeoUnd>0</AdGeoUnd>
                <TfcIntl>non</TfcIntl>
                <TfcNtl>non</TfcNtl>
                <TfcIfr>non</TfcIfr>
                <TfcVfr>non</TfcVfr>
                <TfcRegulier>non</TfcRegulier>
                <TfcNonRegulier>non</TfcNonRegulier>
                <TfcPrive>non</TfcPrive>
                <AdAfs>LFMMZTZX</AdAfs>
                <HorAdminCode>H24</HorAdminCode>
                <Geometrie>44.989722,-8.539722</Geometrie>
            </Ad>
        </AdS>
        <RwyS>
            <Rwy pk="565" lk="[LF][OP][05/23]">
                <Ad pk="89" lk="[LF][OP]"/>
                <Rwy>05/23</Rwy>
                <Longueur>900</Longueur>
                <Principale>non</Principale>
                <Revetement>gazon</Revetement>
                <LatDThr1>49.384782</LatDThr1>
                <LongDThr1>1.186415</LongDThr1>
                <AltFtDThr1>492</AltFtDThr1>
                <Largeur>80</Largeur>
                <OrientationGeo>43.82</OrientationGeo>
                <LatDThr2>49.389542</LatDThr2>
                <LongDThr2>1.193412</LongDThr2>
                <AltFtDThr2>509</AltFtDThr2>
                <Lda1>815</Lda1>
                <Lda2>815</Lda2>
                <Geometrie>49.384782,1.186415
49.389542,1.193412</Geometrie>
            </Rwy>
        </RwyS>
        <ServiceS>
            <Service pk="300198" lk="[LF][OP][A/A ROUEN .]">
                <Ad pk="89" lk="[LF][OP]"/>
                <Service>A/A</Service>
                <IndicLieu>ROUEN</IndicLieu>
                <IndicService>.</IndicService>
                <Langue>fr</Langue>
            </Service>
            <Service pk="7800" lk="[LF][OP][TWR ROUEN Tour]">
                <Espace pk="1208" lk="[LF][CTR ROUEN]"/>
                <Ad pk="89" lk="[LF][OP]"/>
                <Service>TWR</Service>
                <IndicLieu>ROUEN</IndicLieu>
                <IndicService>Tour</IndicService>
                <Langue>fr</Langue>
            </Service>
            <Service pk="7780" lk="[LF][OP][ATIS ROUEN .]">
                <Ad pk="89" lk="[LF][OP]"/>
                <Service>ATIS</Service>
                <IndicLieu>ROUEN</IndicLieu>
                <IndicService>.</IndicService>
                <Langue>fr</Langue>
            </Service>
            <Service pk="300145" lk="[LF][BO][TWR BLAGNAC Sol]">
                <Ad pk="100" lk="[LF][BO]"/>
                <Service>TWR</Service>
                <IndicLieu>BLAGNAC</IndicLieu>
                <IndicService>Sol</IndicService>
                <Langue>fr</Langue>
            </Service>
            <Service pk="300116" lk="[LF][CTR BLAGNAC][TWR BLAGNAC Tour]">
                <Espace pk="300242" lk="[LF][CTR BLAGNAC]"/>
                <Service>TWR</Service>
                <IndicLieu>BLAGNAC</IndicLieu>
                <IndicService>Tour</IndicService>
                <Langue>fr</Langue>
            </Service>
        </ServiceS>
        <FrequenceS>
            <Frequence pk="300898" lk="[LF][OP][A/A ROUEN .][120.200]">
                <Service pk="300198" lk="[LF][OP][A/A ROUEN .]"/>
                <Frequence>120.200</Frequence>
                <HorCode>HX</HorCode>
                <Remarque>Absence ATS</Remarque>
            </Frequence>
            <Frequence pk="7800" lk="[LF][OP][TWR ROUEN Tour][120.200]">
                <Service pk="7800" lk="[LF][OP][TWR ROUEN Tour]"/>
                <Frequence>120.200</Frequence>
                <HorCode>HO</HorCode>
            </Frequence>
            <Frequence pk="7780" lk="[LF][OP][ATIS ROUEN .][120.730]">
                <Service pk="7780" lk="[LF][OP][ATIS ROUEN .]"/>
                <Frequence>120.730</Frequence>
                <HorCode>HX</HorCode>
                <Remarque>TEL : 02 35 80 80 34</Remarque>
            </Frequence>
            <Frequence pk="300806" lk="[LF][BO][TWR BLAGNAC Sol][121.905]">
                <Service pk="300145" lk="[LF][BO][TWR BLAGNAC Sol]"/>
                <Frequence>121.905</Frequence>
                <HorCode>H24</HorCode>
            </Frequence>
            <Frequence pk="300732" lk="[LF][CTR BLAGNAC][TWR BLAGNAC Tour][118.105]">
                <Service pk="300116" lk="[LF][CTR BLAGNAC][TWR BLAGNAC Tour]"/>
                <Frequence>118.105</Frequence>
                <HorCode>H24</HorCode>
            </Frequence>
        </FrequenceS>
        <EspaceS>
            <Espace pk="300242" lk="[LF][CTR BLAGNAC]">
                <Territoire pk="100" lk="[LF]"/>
                <TypeEspace>CTR</TypeEspace>
                <Nom>BLAGNAC</Nom>
                <AdAssocie pk="100" lk="[LF][BO]"/>
            </Espace>
            <Espace pk="1328" lk="[LF][Pje 215]">
                <Territoire pk="100" lk="[LF]"/>
                <TypeEspace>Pje</TypeEspace>
                <Nom>215</Nom>
                <AdAssocie pk="128" lk="[LF][QM]"/>
            </Espace>
            <Espace pk="4877" lk="[LF][SUR 231]">
                <Territoire pk="100" lk="[LF]"/>
                <TypeEspace>SUR</TypeEspace>
                <Nom>231</Nom>
            </Espace>
            <Espace pk="1024" lk="[LF][Aer 8430]">
                <Territoire pk="100" lk="[LF]"/>
                <TypeEspace>Aer</TypeEspace>
                <Nom>8430</Nom>
            </Espace>
        </EspaceS>
        <PartieS>
            <Partie pk="361" lk="[LF][Pje 215][.]">
                <Espace pk="1328" lk="[LF][Pje 215]"/>
                <NomPartie>.</NomPartie>
                <NumeroPartie>10</NumeroPartie>
                <NomUsuel>BESANCON LA VEZE AERODROME (LFQM)</NomUsuel>
                <Contour>1000010,Cloture=3372,47.205278 6.080556,grc(47.205278 6.080556:0m:=)	oui</Contour>
                <Geometrie>47.205278,6.080556</Geometrie>
            </Partie>
            <Partie pk="5454" lk="[LF][SUR 231][.]">
                <Espace pk="4877" lk="[LF][SUR 231]"/>
                <NomPartie>.</NomPartie>
                <NumeroPartie>10</NumeroPartie>
                <NomUsuel>Site industriel d'ETREZ Nord</NomUsuel>
                <Contour>1000010,Cloture=25232,46.341667 5.208333,grc(46.341667 5.208333:0m:=)	oui</Contour>
                <Geometrie>46.341667,5.208333</Geometrie>
            </Partie>
            <Partie pk="24" lk="[LF][Aer 8430][.]">
                <Espace pk="1024" lk="[LF][Aer 8430]"/>
                <NomPartie>.</NomPartie>
                <NumeroPartie>10</NumeroPartie>
                <NomUsuel>CERNAY (68)</NomUsuel>
                <Contour>1000010,Cloture=2730,47.811111 7.201944,grc(47.811111 7.201944:0m:=)	oui</Contour>
                <Geometrie>47.811111,7.201944</Geometrie>
            </Partie>
        </PartieS>
        <VolumeS>
            <Volume pk="702" lk="[LF][Pje 215][.][10]">
                <Partie pk="361" lk="[LF][Pje 215][.]"/>
                <Sequence>10</Sequence>
                <PlafondRefUnite>FL</PlafondRefUnite>
                <Plafond>145</Plafond>
                <PlancherRefUnite>SFC</PlancherRefUnite>
                <Plancher>0</Plancher>
                <HorCode>HX</HorCode>
                <HorTxt>SUM : MON-FRI : 0700-SS#WIN : MON-FRI : 0800-SS#SAT, SUN and HOL: SR-SS</HorTxt>
                <Remarque>Activité réservée aux usagers autorisés par l'exploitant d'aérodrome.#
Au-dessus de 5000 ft ASFC, lorsque la R158A est active, contact radio obligatoire avec RAKI RADAR ou CDC de remplacement: 119.700, SSR obligatoire.#
Une attente éventuelle de 6 à 10 minutes MAX pourra être demandée par RAKI RADAR ou CDC de remplacement.#
Au-dessus du FL 115, largages possibles hors activité militaire : PPR BALE INFO .</Remarque>
            </Volume>
            <Volume pk="305871" lk="[LF][SUR 231][.][10]">
                <Partie pk="5454" lk="[LF][SUR 231][.]"/>
                <Sequence>10</Sequence>
                <PlafondRefUnite>ft ASFC</PlafondRefUnite>
                <Plafond>1000</Plafond>
                <Plafond2>3300</Plafond2>
                <PlancherRefUnite>SFC</PlancherRefUnite>
                <Plancher>0</Plancher>
                <HorCode>H24</HorCode>
                <HorTxt>H24</HorTxt>
                <Activite>Survols interdits à basse ALT#1000ft MNM monomoteurs à piston/hélicoptères#3300ft MNM autres ACFT moto-propulsés</Activite>
                <Remarque>FIR MARSEILLE#Département :AIN</Remarque>
            </Volume>
            <Volume pk="443" lk="[LF][Aer 8430][.][10]">
                <Partie pk="24" lk="[LF][Aer 8430][.]"/>
                <Sequence>10</Sequence>
                <PlafondRefUnite>ft AMSL</PlafondRefUnite>
                <Plafond>2500</Plafond>
                <Plafond2>1500</Plafond2>
                <PlancherRefUnite>SFC</PlancherRefUnite>
                <Plancher>0</Plancher>
                <HorCode>HJ</HorCode>
                <HorTxt>SR-SS</HorTxt>
                <Remarque>Vols radiocommandés.</Remarque>
            </Volume>
        </VolumeS>
        <ObstacleS>
            <Obstacle pk="312730" lk="[LF][E4414-1]">
                <Territoire pk="100" lk="[LF]"/>
                <NumeroNom>E4414-1</NumeroNom>
                <Latitude>46.991578</Latitude>
                <Longitude>-1.641</Longitude>
                <Wgs84>2</Wgs84>
                <TypeObst>Eolienne(s)</TypeObst>
                <Combien>1</Combien>
                <AmslFt>503</AmslFt>
                <AglFt>408</AglFt>
                <Balisage>jour et nuit</Balisage>
                <Geometrie>46.991578,-1.641</Geometrie>
            </Obstacle>
        </ObstacleS>
    </Situation>
</SiaExport>
`;

export const AIXM_2610_GAPS_XML = String.raw`<?xml version="1.0" encoding="UTF-8"?>
<AIXM-Snapshot created="2026-08-21T10:46:16.849+02:00" origin="Sia-France" version="4.5" effective="2026-10-01T00:00:00.000+02:00">
    <Rdn>
        <RdnUid mid="1535133">
            <RwyUid mid="1528621">
                <AhpUid mid="1521008">
                    <codeId>LFOP</codeId>
                </AhpUid>
                <txtDesig>05/23</txtDesig>
            </RwyUid>
            <txtDesig>23</txtDesig>
        </RdnUid>
        <valTrueBrg>223.82</valTrueBrg>
        <valMagBrg>222.38</valMagBrg>
    </Rdn>
    <Rdn>
        <RdnUid mid="1535089">
            <RwyUid mid="1528621">
                <AhpUid mid="1521008">
                    <codeId>LFOP</codeId>
                </AhpUid>
                <txtDesig>05/23</txtDesig>
            </RwyUid>
            <txtDesig>05</txtDesig>
        </RdnUid>
        <valTrueBrg>043.82</valTrueBrg>
        <valMagBrg>042.38</valMagBrg>
    </Rdn>
    <Rdd>
        <RddUid mid="1586040">
            <RdnUid mid="1535089">
                <RwyUid mid="1528621">
                    <AhpUid mid="1521008">
                        <codeId>LFOP</codeId>
                    </AhpUid>
                    <txtDesig>05/23</txtDesig>
                </RwyUid>
                <txtDesig>05</txtDesig>
            </RdnUid>
            <codeType>ASDA</codeType>
            <codeDayPeriod>OTHER</codeDayPeriod>
        </RddUid>
        <valDist>900</valDist>
        <uomDist>M</uomDist>
    </Rdd>
    <Rdd>
        <RddUid mid="1587578">
            <RdnUid mid="1535089">
                <RwyUid mid="1528621">
                    <AhpUid mid="1521008">
                        <codeId>LFOP</codeId>
                    </AhpUid>
                    <txtDesig>05/23</txtDesig>
                </RwyUid>
                <txtDesig>05</txtDesig>
            </RdnUid>
            <codeType>TODA</codeType>
            <codeDayPeriod>OTHER</codeDayPeriod>
        </RddUid>
        <valDist>900</valDist>
        <uomDist>M</uomDist>
    </Rdd>
    <Rdd>
        <RddUid mid="1586858">
            <RdnUid mid="1535089">
                <RwyUid mid="1528621">
                    <AhpUid mid="1521008">
                        <codeId>LFOP</codeId>
                    </AhpUid>
                    <txtDesig>05/23</txtDesig>
                </RwyUid>
                <txtDesig>05</txtDesig>
            </RdnUid>
            <codeType>TORA</codeType>
            <codeDayPeriod>OTHER</codeDayPeriod>
        </RddUid>
        <valDist>900</valDist>
        <uomDist>M</uomDist>
    </Rdd>
    <Rdd>
        <RddUid mid="1592452">
            <RdnUid mid="1535089">
                <RwyUid mid="1528621">
                    <AhpUid mid="1521008">
                        <codeId>LFOP</codeId>
                    </AhpUid>
                    <txtDesig>05/23</txtDesig>
                </RwyUid>
                <txtDesig>05</txtDesig>
            </RdnUid>
            <codeType>LDA</codeType>
            <codeDayPeriod>OTHER</codeDayPeriod>
        </RddUid>
        <valDist>815</valDist>
        <uomDist>M</uomDist>
    </Rdd>
    <Rdd>
        <RddUid mid="59823598">
            <RdnUid mid="1536591">
                <RwyUid mid="1527993">
                    <AhpUid mid="1520940">
                        <codeId>LFLY</codeId>
                    </AhpUid>
                    <txtDesig>16/34</txtDesig>
                </RwyUid>
                <txtDesig>16</txtDesig>
            </RdnUid>
            <TwyUid mid="59823586">
                <AhpUid mid="1520940">
                    <codeId>LFLY</codeId>
                </AhpUid>
                <txtDesig>A3</txtDesig>
            </TwyUid>
            <codeType>TORA</codeType>
            <codeDayPeriod>OTHER</codeDayPeriod>
        </RddUid>
        <valDist>940</valDist>
        <uomDist>M</uomDist>
    </Rdd>
</AIXM-Snapshot>
`;

export const sia2610GapsBuffer = (): Buffer =>
  Buffer.from(SIA_2610_GAPS_XML, 'latin1');
