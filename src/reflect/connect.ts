type Omit<T, K> = Pick<T, Exclude<keyof T, K>>;

export function connect<State, Map, Props, MyProps>(
    component: (props: Props) => any,
    map: (state: State, props: MyProps) => Map
) {
    return (props: Omit<Props, keyof Map> & MyProps) => 1;
}
