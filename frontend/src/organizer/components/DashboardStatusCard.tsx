import { type ReactNode} from "react";
import Icon from "../../shared/components/Icon"
import "./styles/statuscard.css"

export interface IStatusCardProps {
    icon? : string;
    title: string,
    children?: ReactNode,
    button?: ReactNode
}

export const DashboardStatusCard = (props : IStatusCardProps)=>  {

    return (
        <section className="dash-stat-card">
            <h2 className="dash-stat-label">{props.icon ? <Icon name={props.icon} /> : ""}{props.title}</h2>
            {props.children ? props.children : ""}
            {props.button && <div className={"dash-stat-action"}>
                {props.button}
            </div>}
        </section>
    )
}