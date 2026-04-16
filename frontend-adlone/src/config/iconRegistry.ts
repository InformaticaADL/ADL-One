import {
    IconDiamond, IconActivity, IconMicroscope, IconDna, IconFlask, IconVirus,
    IconFilter, IconArrowsLeftRight, IconLeaf, IconTruckDelivery, IconBulb,
    IconStethoscope, IconCpu, IconChartBar, IconCertificate, IconBuilding,
    IconCalculator, IconChartPie, IconSettings, IconQuestionMark
} from '@tabler/icons-react';

export const IconRegistry: Record<string, React.ElementType> = {
    'IconDiamond': IconDiamond,
    'IconActivity': IconActivity,
    'IconMicroscope': IconMicroscope,
    'IconDna': IconDna,
    'IconFlask': IconFlask,
    'IconVirus': IconVirus,
    'IconFilter': IconFilter,
    'IconArrowsLeftRight': IconArrowsLeftRight,
    'IconLeaf': IconLeaf,
    'IconTruckDelivery': IconTruckDelivery,
    'IconBulb': IconBulb,
    'IconStethoscope': IconStethoscope,
    'IconCpu': IconCpu,
    'IconChartBar': IconChartBar,
    'IconCertificate': IconCertificate,
    'IconBuilding': IconBuilding,
    'IconCalculator': IconCalculator,
    'IconChartPie': IconChartPie,
    'IconSettings': IconSettings
};

export const getIconComponent = (iconName: string): React.ElementType => {
    return IconRegistry[iconName] || IconQuestionMark;
};
