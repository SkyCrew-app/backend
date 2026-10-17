// Unmodified records of the real SIA "XML SIA" export of AIRAC 2310
// (XML_SIA_2023-10-05.xml in export_xml_bd_sia_2023-10-05-s2.zip,
// Service de l'Information Aéronautique, Licence Ouverte), kept for the
// outline forms the hand-written sample does not have: areas published as a
// single point (PRN 390, D 595), a part defined in words (LTA FRANCE 2), a
// part of several rings (PRN 25), a repeated point (TMA BALE deleg.LANGEN
// S-E). OUT OF DATE: never use them for navigation. The whole file (26 MB,
// no licence note in the zip) is not kept: set SIA_REAL_EXPORT to its zip to
// run the regression test on it.
export const SIA_2310_EXCERPTS_XML = String.raw`<?xml version="1.0" encoding="ISO-8859-1"?>
<SiaExport Date="2023-08-10T11:34:18.454+02:00" Origine="Sia-France" Version="5">
    <Situation pubDate="2023-08-24" effDate="2023-10-05">
        <EspaceS>
            <Espace pk="4598" lk="[LF][PRN 390]">
                <Territoire pk="100" lk="[LF]"/>
                <TypeEspace>PRN</TypeEspace>
                <Nom>390</Nom>
            </Espace>
            <Espace pk="300287" lk="[LF][LTA FRANCE]">
                <Territoire pk="100" lk="[LF]"/>
                <TypeEspace>LTA</TypeEspace>
                <Nom>FRANCE</Nom>
            </Espace>
            <Espace pk="300321" lk="[TF][PRN 25]">
                <Territoire pk="1300" lk="[TF]"/>
                <TypeEspace>PRN</TypeEspace>
                <Nom>25</Nom>
            </Espace>
            <Espace pk="300232" lk="[LF][TMA BALE]">
                <Territoire pk="100" lk="[LF]"/>
                <TypeEspace>TMA</TypeEspace>
                <Nom>BALE</Nom>
                <AltrFt>7000</AltrFt>
                <AdAssocie pk="10" lk="[LF][SB]"/>
            </Espace>
            <Espace pk="1292" lk="[LF][D 595]">
                <Territoire pk="100" lk="[LF]"/>
                <TypeEspace>D</TypeEspace>
                <Nom>595</Nom>
            </Espace>
        </EspaceS>
        <PartieS>
            <Partie pk="4833" lk="[LF][PRN 390][.]">
                <Espace pk="4598" lk="[LF][PRN 390]"/>
                <NomPartie>.</NomPartie>
                <NumeroPartie>10</NumeroPartie>
                <NomUsuel>PARC NATIONAL DES CEVENNES</NomUsuel>
                <Contour>1000010,Cloture=21618,44.25 3.583333,grc(44.25 3.583333:0m:=)	oui</Contour>
                <Geometrie>44.25,3.583333</Geometrie>
            </Partie>
            <Partie pk="6155" lk="[LF][LTA FRANCE][2]">
                <Espace pk="300287" lk="[LF][LTA FRANCE]"/>
                <NomPartie>2</NomPartie>
                <NumeroPartie>20</NumeroPartie>
                <Contour>1000010,Cloture=28043,45 -4,grc(45 -4:0m:=)	non	Espace situé au-dessus des eaux internationales de la Méditerranée, de l'Atlantique, de la Manche et de la Mer du Nord, compris entre les lignes brisées situées au-delà de 12 NM des côtes et les limites concernées définies en partie 1.</Contour>
                <Geometrie>45,-4</Geometrie>
            </Partie>
            <Partie pk="300261" lk="[TF][PRN 25][.]">
                <Espace pk="300321" lk="[TF][PRN 25]"/>
                <NomPartie>.</NomPartie>
                <NumeroPartie>10</NumeroPartie>
                <NomUsuel>ILETS KAHOUANNE</NomUsuel>
                <Contour>1000010,Cloture=300943,16.363889 -61.777778,grc(16.363889 -61.777778:0m:=)
1000020,Cloture=305020,16.365 -61.780556,grc(16.365 -61.780556:0m:=)
1000030,Cloture=305021,16.366667 -61.781667,grc(16.366667 -61.781667:0m:=)
1000040,Cloture=305022,16.370833 -61.781111,grc(16.370833 -61.781111:0m:=)
1000050,Cloture=305023,16.368056 -61.777778,grc(16.368056 -61.777778:0m:=)
1000060,Cloture=305024,16.363889 -61.777778,grc(16.363889 -61.777778:0m:=)
1000070,Cloture=305025,16.368611 -61.777222,grc(16.368611 -61.777222:0m:=)
1000080,Cloture=305026,16.368889 -61.7775,grc(16.368889 -61.7775:0m:=)
1000090,Cloture=305027,16.366667 -61.776944,grc(16.366667 -61.776944:0m:=)
1000100,Cloture=305028,16.368889 -61.776944,grc(16.368889 -61.776944:0m:=)
1000110,Cloture=305029,16.368611 -61.777222,grc(16.368611 -61.777222:0m:=)
1000120,Cloture=305030,16.363889 -61.777778,grc(16.363889 -61.777778:0m:=)</Contour>
                <Geometrie>16.368889,-61.7775
16.368044,-61.777289
16.366667,-61.776944
16.368889,-61.776944
16.368611,-61.777222
16.368889,-61.7775</Geometrie>
            </Partie>
            <Partie pk="301461" lk="[LF][TMA BALE][deleg.LANGEN S-E]">
                <Espace pk="300232" lk="[LF][TMA BALE]"/>
                <NomPartie>deleg.LANGEN S-E</NomPartie>
                <NumeroPartie>210</NumeroPartie>
                <Contour>1000010,Cloture=306360,47.933333 7.584981,grc(47.933333 7.584981:0m:=)
1000020,Cloture=306361,47.696944 7.749444,grc(47.696944 7.749444:0m:=)
1000030,Cloture=306362,47.586667 7.755278,grc(47.586667 7.755278:0m:=)
1000040,Cloture=306363,47.743256 7.633208,grc(47.743256 7.633208:0m:=)
1000050,Cloture=306364,47.836792 7.560292,fnt(47.836792 7.560292:12:25:37:0m:=)
1000060,Cloture=306365,47.933333 7.584981,grc(47.933333 7.584981:0m:=)</Contour>
                <Geometrie>47.933333,7.584981
47.931578,7.583478
47.922142,7.580558
47.901947,7.582919
47.894144,7.579072
47.889089,7.572092
47.884856,7.562561
47.879,7.557078
47.873847,7.555561
47.867189,7.555853
47.854292,7.562608
47.848758,7.563578
47.843628,7.563128
47.836792,7.560292
47.836792,7.560292
47.743256,7.633208
47.586667,7.755278
47.696944,7.749444
47.933333,7.584981</Geometrie>
            </Partie>
            <Partie pk="325" lk="[LF][D 595][.]">
                <Espace pk="1292" lk="[LF][D 595]"/>
                <NomPartie>.</NomPartie>
                <NumeroPartie>10</NumeroPartie>
                <NomUsuel>LASER HAUTE PROVENCE</NomUsuel>
                <Contour>1000010,Cloture=3291,43.931111 5.715,grc(43.931111 5.715:0m:=)	oui</Contour>
                <Geometrie>43.931111,5.715</Geometrie>
            </Partie>
        </PartieS>
        <VolumeS>
            <Volume pk="4886" lk="[LF][PRN 390][.][10]">
                <Partie pk="4833" lk="[LF][PRN 390][.]"/>
                <Sequence>10</Sequence>
                <PlafondRefUnite>ft ASFC</PlafondRefUnite>
                <Plafond>3300</Plafond>
                <PlancherRefUnite>SFC</PlancherRefUnite>
                <Plancher>0</Plancher>
                <HorCode>H24</HorCode>
                <HorTxt>H24</HorTxt>
                <Activite>Survol / Overflight</Activite>
                <Remarque>FIR MARSEILLE#Département : GARD</Remarque>
            </Volume>
            <Volume pk="6268" lk="[LF][LTA FRANCE][2][10]">
                <Partie pk="6155" lk="[LF][LTA FRANCE][2]"/>
                <Sequence>10</Sequence>
                <PlafondRefUnite>FL</PlafondRefUnite>
                <Plafond>195</Plafond>
                <PlancherRefUnite>FL</PlancherRefUnite>
                <Plancher>115</Plancher>
                <Classe>E</Classe>
                <HorCode>HX</HorCode>
                <Remarque>Sauf mention contraire, à l'exclusion :#  - des TMA et AWY#- des zones P, R, D#- des CTA#- des TRA#- des CBA#- des TSA#lorsqu'ils sont actifs#Fréquences : voir GEN 3.4</Remarque>
            </Volume>
            <Volume pk="300964" lk="[TF][PRN 25][.][10]">
                <Partie pk="300261" lk="[TF][PRN 25][.]"/>
                <Sequence>10</Sequence>
                <PlafondRefUnite>ft ASFC</PlafondRefUnite>
                <Plafond>3300</Plafond>
                <PlancherRefUnite>SFC</PlancherRefUnite>
                <Plancher>0</Plancher>
                <HorCode>H24</HorCode>
                <HorTxt>H24</HorTxt>
                <Activite>Survol / Overflight</Activite>
                <Remarque>FIR PIARCO#
GUADELOUPE</Remarque>
            </Volume>
            <Volume pk="309475" lk="[LF][TMA BALE][deleg.LANGEN S-E][10]">
                <Partie pk="301461" lk="[LF][TMA BALE][deleg.LANGEN S-E]"/>
                <Sequence>10</Sequence>
                <PlafondRefUnite>FL</PlafondRefUnite>
                <Plafond>115</Plafond>
                <PlancherRefUnite>FL</PlancherRefUnite>
                <Plancher>100</Plancher>
                <Classe>C</Classe>
                <HorCode>H24</HorCode>
                <HorTxt>H24</HorTxt>
                <Activite>LFSB BALE#APP#BALE Approche (FR)#BALE Approach (EN)</Activite>
                <Remarque>Par délégation de LANGEN ACC.# STAUFEN AREA</Remarque>
            </Volume>
            <Volume pk="309477" lk="[LF][TMA BALE][deleg.LANGEN S-E][20]">
                <Partie pk="301461" lk="[LF][TMA BALE][deleg.LANGEN S-E]"/>
                <Sequence>20</Sequence>
                <PlafondRefUnite>FL</PlafondRefUnite>
                <Plafond>100</Plafond>
                <PlancherRefUnite>ft AMSL</PlancherRefUnite>
                <Plancher>5500</Plancher>
                <Classe>D</Classe>
                <HorCode>HX</HorCode>
                <Activite>LFSB BALE#APP#BALE Approche (FR)#BALE Approach (EN)</Activite>
            </Volume>
            <Volume pk="309478" lk="[LF][TMA BALE][deleg.LANGEN S-E][30]">
                <Partie pk="301461" lk="[LF][TMA BALE][deleg.LANGEN S-E]"/>
                <Sequence>30</Sequence>
                <PlafondRefUnite>ft AMSL</PlafondRefUnite>
                <Plafond>5500</Plafond>
                <PlancherRefUnite>ft ASFC</PlancherRefUnite>
                <Plancher>2500</Plancher>
                <Classe>E</Classe>
                <HorCode>HX</HorCode>
                <Activite>LFSB BALE#APP#BALE Approche (FR)#BALE Approach (EN)</Activite>
            </Volume>
            <Volume pk="307441" lk="[LF][D 595][.][10]">
                <Partie pk="325" lk="[LF][D 595][.]"/>
                <Sequence>10</Sequence>
                <PlafondRefUnite>FL</PlafondRefUnite>
                <Plafond>195</Plafond>
                <PlancherRefUnite>SFC</PlancherRefUnite>
                <Plancher>0</Plancher>
                <HorCode>H24</HorCode>
                <HorTxt>H24</HorTxt>
                <Activite>Rayonnement laser pouvant entraîner des lésions occulaires#\\Laser radiation which can result in eye injuries.</Activite>
            </Volume>
        </VolumeS>
    </Situation>
</SiaExport>
`;

export const sia2310ExcerptsBuffer = (): Buffer =>
  Buffer.from(SIA_2310_EXCERPTS_XML, 'latin1');
