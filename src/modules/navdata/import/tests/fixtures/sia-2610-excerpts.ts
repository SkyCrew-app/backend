// Records (content unchanged, re-indented) of the real SIA "XML SIA" export of AIRAC 2610
// (XML_SIA_2026-10-01.xml in export_xml_bd_sia_2026-10-01-v02.zip, Service
// de l'Information Aéronautique, Licence Ouverte): CTR AGEN LA GARENNE and
// the service TWR AGEN that names both the aerodrome LFBA and the CTR, with
// its frequency; R 97 MONCE, whose activity is bilingual ("#\\" before the
// English). OUT OF DATE after 2026-10-29: never use them for navigation.
export const SIA_2610_EXCERPTS_XML = String.raw`<?xml version="1.0" encoding="ISO-8859-1"?>
<SiaExport Date="2026-08-21T10:25:54.385+02:00" Origine="Sia-France" Version="5">
    <Situation pubDate="2026-08-20" effDate="2026-10-01">
        <ServiceS>
            <Service pk="20" lk="[LF][BA][TWR AGEN Tour]">
                <Espace pk="1158" lk="[LF][CTR AGEN LA GARENNE]" />
                <Ad pk="1" lk="[LF][BA]" />
                <Service>TWR</Service>
                <IndicLieu>AGEN</IndicLieu>
                <IndicService>Tour</IndicService>
                <Langue>fr</Langue>
            </Service>
        </ServiceS>
        <FrequenceS>
            <Frequence pk="20" lk="[LF][BA][TWR AGEN Tour][121.305]">
                <Service pk="20" lk="[LF][BA][TWR AGEN Tour]" />
                <Frequence>121.305</Frequence>
                <HorCode>HO</HorCode>
            </Frequence>
        </FrequenceS>
        <EspaceS>
            <Espace pk="1158" lk="[LF][CTR AGEN LA GARENNE]">
                <Territoire pk="100" lk="[LF]" />
                <TypeEspace>CTR</TypeEspace>
                <Nom>AGEN LA GARENNE</Nom>
                <AdAssocie pk="1" lk="[LF][BA]" />
            </Espace>
            <Espace pk="4367" lk="[LF][R 97]">
                <Territoire pk="100" lk="[LF]" />
                <TypeEspace>R</TypeEspace>
                <Nom>97</Nom>
            </Espace>
        </EspaceS>
        <PartieS>
            <Partie pk="159" lk="[LF][CTR AGEN LA GARENNE][.]">
                <Espace pk="1158" lk="[LF][CTR AGEN LA GARENNE]" />
                <NomPartie>.</NomPartie>
                <NumeroPartie>10</NumeroPartie>
                <Contour>1000010,Cloture=1270,44.278889 0.474722,grc(44.278997 0.4746:0m:=)	oui
1000020,Cloture=1271,44.23 0.759167,cwa(44.230172 0.759697:8:nm:44.174722 0.590556:0m:=)	oui		oui	ARP
1000040,Cloture=1273,44.048889 0.651944,grc(44.048883 0.651944:0m:=)	oui
1000050,Cloture=18293,44.094167 0.518056,grc(44.094167 0.518056:0m:=)	oui
1000070,Cloture=18295,44.141944 0.411111,cwa(44.141822 0.41045:8:nm:44.174722 0.590556:0m:=)	oui		oui	ARP
1000080,Cloture=18296,44.278889 0.474722,grc(44.278997 0.4746:0m:=)	oui</Contour>
                <Geometrie>44.278889,.474722
44.278357,.47391
44.27565,.469411
44.272843,.465033
44.269937,.460781
44.266937,.456659
44.263843,.452672
44.260661,.448824
44.257393,.445118
44.254042,.441558
44.250612,.438147
44.247105,.43489
44.243527,.431788
44.239879,.428847
44.236167,.426067
44.232393,.423452
44.228562,.421005
44.224676,.418728
44.220741,.416624
44.21676,.414693
44.212737,.412939
44.208676,.411363
44.204582,.409966
44.200457,.40875
44.196307,.407717
44.192136,.406866
44.187947,.406199
44.183745,.405717
44.179534,.405419
44.175319,.405307
44.171103,.40538
44.166891,.405638
44.162687,.406081
44.158495,.406709
44.154319,.40752
44.150164,.408514
44.146034,.409689
44.141944,.411111
44.094167,.518056
44.048889,.651944
44.049681,.654822
44.051206,.660272
44.052854,.665653
44.054624,.67096
44.056513,.676187
44.058521,.681328
44.060644,.68638
44.062882,.691336
44.065231,.696192
44.06769,.700942
44.070255,.705584
44.072925,.71011
44.075696,.714518
44.078567,.718802
44.081533,.722959
44.084593,.726984
44.087742,.730873
44.090979,.734623
44.094299,.738229
44.0977,.741688
44.101177,.744996
44.104728,.748151
44.10835,.751148
44.112037,.753986
44.115788,.75666
44.119597,.759169
44.123462,.76151
44.127377,.763681
44.131341,.765678
44.135348,.767501
44.139394,.769148
44.143476,.770616
44.147589,.771904
44.151729,.773011
44.155892,.773936
44.160075,.774678
44.164272,.775236
44.16848,.775609
44.172694,.775798
44.17691,.775801
44.181125,.775618
44.185333,.775251
44.18953,.774699
44.193713,.773963
44.197878,.773043
44.202019,.77194
44.206133,.770656
44.210215,.769191
44.214262,.767548
44.21827,.765727
44.222235,.763731
44.226152,.761561
44.23,.759167
44.278889,.474722</Geometrie>
            </Partie>
            <Partie pk="4565" lk="[LF][R 97][.]">
                <Espace pk="4367" lk="[LF][R 97]" />
                <NomPartie>.</NomPartie>
                <NumeroPartie>10</NumeroPartie>
                <NomUsuel>MONCE</NomUsuel>
                <Contour>1000010,Cloture=20066,48.798333 6.660278,grc(48.798333 6.660278:0m:=)	oui
1000020,Cloture=20067,48.654167 6.54,grc(48.654167 6.54:0m:=)	oui
1000030,Cloture=20068,48.746667 6.328333,grc(48.746667 6.328333:0m:=)	oui
1000040,Cloture=20069,48.798333 6.660278,grc(48.798333 6.660278:0m:=)	oui</Contour>
                <Geometrie>48.798333,6.660278
48.746667,6.328333
48.654167,6.54
48.798333,6.660278</Geometrie>
            </Partie>
        </PartieS>
        <VolumeS>
            <Volume pk="224" lk="[LF][CTR AGEN LA GARENNE][.][10]">
                <Partie pk="159" lk="[LF][CTR AGEN LA GARENNE][.]" />
                <Sequence>10</Sequence>
                <PlafondRefUnite>ft AMSL</PlafondRefUnite>
                <Plafond>2000</Plafond>
                <PlancherRefUnite>SFC</PlancherRefUnite>
                <Plancher>0</Plancher>
                <Classe>D</Classe>
                <HorCode>TS</HorCode>
                <HorTxt>HOR ATC voir/see AD 2 LFBA.3.7.</HorTxt>
            </Volume>
            <Volume pk="307813" lk="[LF][R 97][.][10]">
                <Partie pk="4565" lk="[LF][R 97][.]" />
                <Sequence>10</Sequence>
                <PlafondRefUnite>FL</PlafondRefUnite>
                <Plafond>65</Plafond>
                <PlancherRefUnite>ft AMSL</PlancherRefUnite>
                <Plancher>3800</Plancher>
                <HorCode>TS</HorCode>
                <HorTxt>Possible activation# SR- 30 - SS+30#According to protocol</HorTxt>
                <Activite>Activités vélivoles.#\\Gliding activities</Activite>
                <Remarque>CAG IFR : contournement obligatoire.#CAG VFR, CAM : Veille obligatoire de la fréquence STRASBOURG APP.#Activité connue de STRASBOURG APP.</Remarque>
            </Volume>
        </VolumeS>
    </Situation>
</SiaExport>
`;

export const sia2610ExcerptsBuffer = (): Buffer =>
  Buffer.from(SIA_2610_EXCERPTS_XML, 'latin1');
